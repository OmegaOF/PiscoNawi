"""
Carga registros de prueba usando imágenes reales de vehículos.

Estructura esperada (no se sube a git):
    backend/dataPrueba/smog/     -> fotos de vehículos CON smog
    backend/dataPrueba/noSmog/   -> fotos de vehículos SIN smog

Qué hace:
  1. Copia las imágenes (reducidas a 1600 px, JPEG) a storage/capturas/prueba/<carpeta>/
     para que el backend las sirva en http://localhost:8000/capturas/prueba/...
  2. Crea (si faltan) el catálogo geográfico completo: país, provincias, ciudades,
     las 9 zonas de captura y una cámara por zona. El script es autocontenido:
     funciona en una base vacía sin cargar catálogos a mano.
  3. Borra los registros demo/prueba anteriores (nunca toca registros reales).
  4. Crea ~800 registros (imagen + predicción) en los últimos 6 meses, con horas pico,
     días hábiles, varios dispositivos y operadores. Las placas quedan vacías
     (se registran a mano en "Registro de placas"); usa --con-placas para rellenarlas.
     Resultado esperado: 3 zonas en rojo (>30 % con smog), 4 en naranja (15-30 %)
     y 2 en verde (<=15 %); global alrededor del 20 %.
     Las imágenes se reparten al azar sin repetirse el mismo día ni de forma consecutiva.

Uso (desde la carpeta backend/, con el entorno virtual activo):
    python seed_prueba.py                 # carga ~800 registros
    python seed_prueba.py --dry-run       # solo muestra el resumen, no escribe nada
    python seed_prueba.py --cantidad 1200 --meses 6 --semilla 3
    python seed_prueba.py --limpiar       # borra los registros de prueba y demo

Marca para identificar/borrar los registros (la observación queda vacía):
    imagenes.filename_original LIKE 'prueba_%'
"""
from __future__ import annotations

import argparse
import random
import sys
from collections import defaultdict
from datetime import date, datetime, time, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from PIL import Image as PILImage, ImageOps
from sqlalchemy.exc import IntegrityError

from db import (
    Ciudad,
    DispositivoCaptura,
    Pais,
    Provincia,
    Imagen,
    Prediccion,
    SessionLocal,
    Ubicacion,
    Usuario,
    engine,
    ensure_schema_upgrades,
)
from seed_demo import (
    DIA_PESO,
    DIA_SMOG_DELTA,
    FRANJA_MIN,
    HORA_PESO_MEDIA,
    HORA_SMOG_DELTA,
    HORA_CAMPO_FIN,
    HORA_CAMPO_INICIO,
    VENTANA_CRITICA,
    VENTANA_CRITICA_BASE_MINIMA,
    VENTANA_CRITICA_VOLUMEN,
    VENTANA_LIMPIA,
    VENTANA_LIMPIA_VOLUMEN,
    MES_SMOG_DELTA,
    USUARIOS_PESO,
    VOLUMEN_FINAL,
    VOLUMEN_INICIAL,
    _gen_placa,
    asignar_ciudades_faltantes,
    clean_demo,
    planificar_jornadas,
)

BACKEND_DIR = Path(__file__).resolve().parent
DATA_DIR = BACKEND_DIR / "dataPrueba"
CARPETA_SMOG = "smog"
CARPETA_SIN_SMOG = "noSmog"
DESTINO = BACKEND_DIR.parent / "storage" / "capturas" / "prueba"
PUBLIC_BASE_URL = "http://localhost:8000/capturas/prueba"
EXTENSIONES = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
LADO_MAX = 1600

PREFIJO = "prueba_"

# Catálogo geográfico base (se crea si la base está vacía).
PAIS = "Bolivia"
CIUDADES = [
    # (nombre ciudad, provincia, latitud, longitud)
    ("Cochabamba", "Cercado", -17.38950, -66.15680),
    ("Quillacollo", "Quillacollo", -17.39200, -66.27800),
    ("Sacaba", "Sacaba", -17.39700, -66.03800),
    ("Tiquipaya", "Tiquipaya", -17.33800, -66.21500),
    ("Colcapirhua", "Colcapirhua", -17.38000, -66.24500),
]

# Zonas de captura: (nombre corto, direccion, departamento, latitud, longitud)
ZONAS = [
    ("6 de Agosto y Panamericana", "6 de Agosto y Panamericana, Cercado", "Cochabamba", -17.4157300, -66.1574900),
    ("Av. América", "Av. América", "Cochabamba", -17.3722446, -66.1643151),
    ("Quillacollo Centro", "Quillacollo Centro", "Cochabamba", -17.3939185, -66.2811640),
    ("Sacaba Plaza", "Sacaba Plaza", "Cochabamba", -17.4041552, -66.0404324),
    ("Tiquipaya Centro", "Tiquipaya Centro", "Cochabamba", -17.3374009, -66.2210755),
    ("Colcapirhua Zona Sur", "Colcapirhua Zona Sur", "Cochabamba", -17.3908891, -66.2382233),
    ("Centro Heroínas Ayacucho", "Centro Heroínas Ayacucho, Cercado", "Cochabamba", -17.3930272, -66.1606105),
    ("Av. Blanco Galindo", "Av. Blanco Galindo Km 4, Cercado", "Cochabamba", -17.3917324, -66.2245591),
    ("Cala Cala", "Cala Cala, Cercado", "Cochabamba", -17.3729836, -66.1687288),
]

# Perfil por zona (clave = dirección): (peso_volumen, prob_smog_base, nombre de la cámara)
# Rojas (>30 % con smog): Quillacollo, Heroínas, Blanco Galindo.
# Naranjas (15-30 %): Av. América, Sacaba, Colcapirhua, Cala Cala.
# Verdes (<=15 %): 6 de Agosto y Panamericana, Tiquipaya.
PERFIL_ZONAS = {
    "6 de Agosto y Panamericana, Cercado": (0.17, 0.03, "Cámara 6 de Agosto y Panamericana"),
    "Av. América": (0.17, 0.12, "Cámara Av. América"),
    "Quillacollo Centro": (0.09, 0.40, "Cámara Quillacollo Centro"),
    "Sacaba Plaza": (0.11, 0.19, "Cámara Sacaba"),
    "Tiquipaya Centro": (0.12, 0.03, "Cámara Tiquipaya"),
    "Colcapirhua Zona Sur": (0.09, 0.12, "Cámara Colcapirhua Zona Sur"),
    "Centro Heroínas Ayacucho, Cercado": (0.08, 0.32, "Cámara Heroínas y Ayacucho"),
    "Av. Blanco Galindo Km 4, Cercado": (0.08, 0.27, "Cámara Av. Blanco Galindo"),
    "Cala Cala, Cercado": (0.09, 0.11, "Cámara Cala Cala"),
}
NOMBRE_CORTO = {direccion: corto for corto, direccion, _, _, _ in ZONAS}

CONFIANZA_MIN, CONFIANZA_MAX = 0.60, 0.90

# Una cámara por lugar: el tercer valor es el nombre del dispositivo que captura en esa zona.
# Si no existe en la base, se crea con estas especificaciones.
SPEC_CAMARA = dict(
    tipo_dispositivo="Camara IP",
    marca="Hikvision",
    modelo="DS-2CD2043G0",
    resolucion="1920x1080",
    fps=30,
    interfaz="Ethernet",
    activo=True,
)

PROB_PLACA = 0.30
# Probabilidad mínima de smog fuera de la ventana limpia del domingo.
PROB_SMOG_MINIMA = 0.01
VENTANA_SIN_REPETIR = 20  # una imagen no reaparece hasta pasar N registros de su misma clase
N_PLACAS_FRECUENTES, N_PLACAS_OCASIONALES, N_PLACAS_SUCIAS = 15, 45, 5


# --------------------------------------------------------------------------- imágenes

def listar_imagenes(carpeta: Path) -> List[Path]:
    if not carpeta.is_dir():
        return []
    return sorted(p for p in carpeta.iterdir() if p.is_file() and p.suffix.lower() in EXTENSIONES and not p.name.startswith("."))


def preparar_imagenes(dry_run: bool) -> Dict[str, List[str]]:
    """Copia y reduce las imágenes a storage/capturas/prueba. Devuelve rutas relativas por clase."""
    pools: Dict[str, List[str]] = {}
    for clase, carpeta in (("smog", CARPETA_SMOG), ("sin_smog", CARPETA_SIN_SMOG)):
        origen = DATA_DIR / carpeta
        archivos = listar_imagenes(origen)
        if not archivos:
            raise SystemExit(f"No hay imágenes en {origen}. Copia ahí las fotos antes de correr el script.")
        destino = DESTINO / carpeta
        if not dry_run:
            destino.mkdir(parents=True, exist_ok=True)
        rel = []
        for f in archivos:
            nombre = f"{f.stem}.jpg"
            salida = destino / nombre
            if not dry_run and (not salida.exists() or salida.stat().st_mtime < f.stat().st_mtime):
                with PILImage.open(f) as im:
                    im = ImageOps.exif_transpose(im).convert("RGB")
                    im.thumbnail((LADO_MAX, LADO_MAX))
                    im.save(salida, "JPEG", quality=85, optimize=True)
            rel.append(f"{carpeta}/{nombre}")
        pools[clase] = rel
        print(f"Imágenes {clase}: {len(rel)} (desde {origen})")
    return pools


# --------------------------------------------------------------------------- zonas

def asegurar_catalogo_geografico(db, dry_run: bool) -> None:
    """Crea país, provincias y ciudades si la base todavía no los tiene."""
    faltantes = [c for c in CIUDADES if db.query(Ciudad).filter(Ciudad.nombre == c[0]).first() is None]
    if not faltantes:
        return
    if dry_run:
        for nombre, *_ in faltantes:
            print(f"[dry-run] Se crearía la ciudad: {nombre}")
        return
    pais = db.query(Pais).filter(Pais.nombre == PAIS).first()
    if pais is None:
        pais = Pais(nombre=PAIS, codigo_iso="BO", created_at=datetime.now(), updated_at=datetime.now())
        db.add(pais)
        db.commit()
        db.refresh(pais)
        print(f"País creado: {PAIS}")
    for nombre, provincia_nombre, lat, lng in faltantes:
        prov = db.query(Provincia).filter(Provincia.nombre == provincia_nombre).first()
        if prov is None:
            prov = Provincia(nombre=provincia_nombre, pais_id=pais.id, created_at=datetime.now(), updated_at=datetime.now())
            db.add(prov)
            db.commit()
            db.refresh(prov)
            print(f"Provincia creada: {provincia_nombre}")
        db.add(Ciudad(nombre=nombre, provincia_id=prov.id, latitud=lat, longitud=lng,
                      created_at=datetime.now(), updated_at=datetime.now()))
        db.commit()
        print(f"Ciudad creada: {nombre}")


def asegurar_zonas(db, dry_run: bool) -> Dict[str, int]:
    """Devuelve dirección -> ubicacion_id, creando las zonas que falten."""
    asegurar_catalogo_geografico(db, dry_run)
    ciudades = db.query(Ciudad).filter(Ciudad.latitud.isnot(None)).all()
    mapa: Dict[str, int] = {}
    for _, direccion, depto, lat, lng in ZONAS:
        u = db.query(Ubicacion).filter(Ubicacion.direccion == direccion).first()
        if u is None:
            if dry_run:
                mapa[direccion] = -1
                print(f"[dry-run] Se crearía la zona: {direccion}")
                continue
            ciudad_id = None
            if ciudades:
                c = min(ciudades, key=lambda c: (float(c.latitud) - lat) ** 2 + (float(c.longitud) - lng) ** 2)
                ciudad_id = c.id
            u = Ubicacion(
                latitud=lat,
                longitud=lng,
                direccion=direccion,
                departamento=depto,
                precision_metros=5,
                dispositivo="camara",
                ciudad_id=ciudad_id,
                created_at=datetime.now(),
                updated_at=datetime.now(),
            )
            db.add(u)
            db.commit()
            db.refresh(u)
            print(f"Zona creada: {direccion} (id {u.id})")
        elif not dry_run and (float(u.latitud) != lat or float(u.longitud) != lng):
            # La zona ya existía con otras coordenadas: se corrige el punto en el mapa.
            u.latitud, u.longitud = lat, lng
            if ciudades:
                u.ciudad_id = min(ciudades, key=lambda c: (float(c.latitud) - lat) ** 2 + (float(c.longitud) - lng) ** 2).id
            u.updated_at = datetime.now()
            db.commit()
            print(f"Zona reubicada: {direccion} -> {lat}, {lng}")
        mapa[direccion] = u.id
    if not mapa:
        raise SystemExit("No se pudieron preparar las zonas de captura.")
    return mapa


def asegurar_dispositivos(db, zonas: Dict[str, int], dry_run: bool) -> Dict[str, Optional[int]]:
    """Devuelve dirección de zona -> dispositivo_id, creando la cámara del lugar si falta."""
    por_nombre = {d.nombre_dispositivo: d for d in db.query(DispositivoCaptura).all()}
    mapa: Dict[str, Optional[int]] = {}
    for clave, (_, _, nombre) in PERFIL_ZONAS.items():
        if clave not in zonas:
            continue
        d = por_nombre.get(nombre) or por_nombre.get(nombre.replace("Cámara", "Camara"))
        if d is not None and d.nombre_dispositivo != nombre and not dry_run:
            d.nombre_dispositivo = nombre  # unificar a "Cámara" con tilde
            db.commit()
            por_nombre[nombre] = d
        if d is None:
            if dry_run:
                print(f"[dry-run] Se crearía el dispositivo: {nombre}")
                mapa[clave] = None
                continue
            lugar = clave
            d = DispositivoCaptura(
                nombre_dispositivo=nombre,
                ubicacion_fisica=", ".join(lugar.split(",")[:2]).strip()[:255] or None,
                fecha_instalacion=datetime(2025, 3, 10),
                **SPEC_CAMARA,
            )
            db.add(d)
            db.commit()
            db.refresh(d)
            por_nombre[nombre] = d
            print(f"Dispositivo creado: {nombre} (id {d.id})")
        elif not d.activo and not dry_run:
            d.activo = True
            db.commit()
        mapa[clave] = d.id
    return mapa


# --------------------------------------------------------------------------- limpieza

def limpiar_prueba(db) -> Dict[str, int]:
    ids = [i for (i,) in db.query(Imagen.id).filter(Imagen.filename_original.like("prueba\\_%", escape="\\")).all()]
    pred = img = 0
    for i in range(0, len(ids), 500):
        chunk = ids[i:i + 500]
        pred += db.query(Prediccion).filter(Prediccion.imagen_id.in_(chunk)).delete(synchronize_session=False)
        img += db.query(Imagen).filter(Imagen.id.in_(chunk)).delete(synchronize_session=False)
    db.commit()
    return {"predicciones": pred, "imagenes": img}


def limpiar_zonas_obsoletas(db) -> List[str]:
    """Borra zonas y cámaras de corridas anteriores que ya no están en ZONAS y quedaron sin imágenes.

    Nunca toca una ubicación que conserve imágenes (reales o de otra fuente).
    """
    direcciones = {direccion for _, direccion, _, _, _ in ZONAS}
    nombres_camara = {nombre for _, _, nombre in PERFIL_ZONAS.values()}
    borradas = []

    def _borrar(modelo, fila, etiqueta):
        """Borra la fila si nada más la referencia; si está en uso, la deja como está."""
        try:
            db.query(modelo).filter(modelo.id == fila.id).delete(synchronize_session=False)
            db.commit()
            borradas.append(etiqueta)
        except IntegrityError:
            db.rollback()  # otra tabla la referencia: se conserva

    for u in db.query(Ubicacion).filter(Ubicacion.direccion.notin_(direcciones)).all():
        if db.query(Imagen.id).filter(Imagen.ubicacion_id == u.id).first():
            continue
        _borrar(Ubicacion, u, u.direccion)
    for d in db.query(DispositivoCaptura).filter(DispositivoCaptura.nombre_dispositivo.notin_(nombres_camara)).all():
        if db.query(Imagen.id).filter(Imagen.dispositivo_captura_id == d.id).first():
            continue
        _borrar(DispositivoCaptura, d, d.nombre_dispositivo)
    return borradas


# --------------------------------------------------------------------------- generación

def generar(db, cantidad: int, meses: int, semilla: int, dry_run: bool, con_placas: bool = False) -> dict:
    rng = random.Random(semilla)
    pools = preparar_imagenes(dry_run)
    rng_img = random.Random(semilla * 7919 + 1)  # flujo aparte: asignación de imágenes y horas de subida
    zonas = asegurar_zonas(db, dry_run)

    claves = [k for k in PERFIL_ZONAS if k in zonas]
    pesos = [PERFIL_ZONAS[k][0] for k in claves]

    disp_por_zona = asegurar_dispositivos(db, zonas, dry_run)
    usuarios = {u.username: u.id for u in db.query(Usuario).all()}
    pares = [(usuarios[n], w) for n, w in USUARIOS_PESO.items() if n in usuarios]
    user_ids = [u for u, _ in pares] or [None]
    user_w = [w for _, w in pares] or [1.0]

    hoy = date.today()
    inicio = hoy - timedelta(days=30 * meses)
    ahora = datetime.now()
    dias = [inicio + timedelta(days=i) for i in range((hoy - inicio).days + 1)]

    # Solo hay capturas en los días que hubo salida a campo, y dentro de esas horas.
    obligatorias = tuple(VENTANA_CRITICA) + tuple(VENTANA_LIMPIA)
    jornadas = planificar_jornadas(dias, rng, obligatorias)
    dias_campo = [d for d in dias if d in jornadas]
    if not dias_campo:
        raise SystemExit("No se planificó ninguna jornada de campo; revisa PROB_SALIDA_DIA.")
    pesos_dia = [
        DIA_PESO[d.weekday()] * (VOLUMEN_INICIAL + (VOLUMEN_FINAL - VOLUMEN_INICIAL) * dias.index(d) / max(len(dias) - 1, 1))
        for d in dias_campo
    ]
    elegidos = rng.choices(dias_campo, pesos_dia, k=cantidad)

    usadas: set = set()
    frecuentes = [_gen_placa(rng, usadas) for _ in range(N_PLACAS_FRECUENTES)]
    ocasionales = [_gen_placa(rng, usadas) for _ in range(N_PLACAS_OCASIONALES)]
    sucias = set(frecuentes[:N_PLACAS_SUCIAS])
    todas = frecuentes + ocasionales
    pesos_placa = [4] * len(frecuentes) + [1] * len(ocasionales)

    stats = defaultdict(lambda: [0, 0])
    total_smog = 0
    usos_img = defaultdict(int)
    registros: List[dict] = []

    for i, dia in enumerate(elegidos):
        horas_jornada = jornadas[dia]
        refuerzo = VENTANA_LIMPIA_VOLUMEN if dia.weekday() == 6 else VENTANA_CRITICA_VOLUMEN
        # Solo las medias horas que caen dentro de la jornada de ese día.
        franjas = [f for f in range(len(HORA_PESO_MEDIA)) if (f * FRANJA_MIN) // 60 in horas_jornada]
        pesos_franja = [
            HORA_PESO_MEDIA[f] * refuerzo.get((dia.weekday(), (f * FRANJA_MIN) // 60), 1.0)
            for f in franjas
        ]
        franja = rng.choices(franjas, pesos_franja)[0]
        hora, minuto = divmod(franja * FRANJA_MIN + rng.randint(0, FRANJA_MIN - 1), 60)
        ts = datetime.combine(dia, time(hora, minuto, rng.randint(0, 59)))
        if ts > ahora:
            # Fecha futura: se mueve a la jornada anterior que cubra esa misma hora.
            previo = next((d for d in reversed(dias_campo) if d < dia and hora in jornadas[d]), None)
            if previo is None:
                previo = next((d for d in dias_campo if hora in jornadas[d]), dia)
            ts = datetime.combine(previo, ts.time())
        hora = ts.hour
        clave = rng.choices(claves, pesos)[0]
        _, base, _ = PERFIL_ZONAS[clave]
        disp_id = disp_por_zona.get(clave)
        ub_id = zonas[clave]
        usuario_id = rng.choices(user_ids, user_w)[0]

        placa = rng.choices(todas, pesos_placa)[0] if rng.random() < PROB_PLACA else None
        prob = (
            base
            + HORA_SMOG_DELTA.get(hora, 0) * 0.4
            + DIA_SMOG_DELTA.get(ts.weekday(), 0) * 0.6
            + MES_SMOG_DELTA.get(ts.month, 0) * 0.6
            + rng.gauss(0, 0.03)
        )
        clave_hora = (ts.weekday(), hora)
        factor_limpio = VENTANA_LIMPIA.get(clave_hora, 1.0)
        prob_critica = VENTANA_CRITICA.get(clave_hora) if base >= VENTANA_CRITICA_BASE_MINIMA else None
        if factor_limpio < 1.0:
            # Ventana limpia del domingo: sin piso, para que sea el mínimo claro de la semana.
            prob = min(prob * factor_limpio, 0.95)
        elif prob_critica is not None:
            # Ventana crítica del miércoles por la tarde: máximo claro de la semana.
            prob = min(prob * prob_critica, 0.95)
        else:
            if placa in sucias:
                prob = 0.45
            prob = min(max(prob, PROB_SMOG_MINIMA), 0.95)
        es_smog = rng.random() < prob

        clase = "smog" if es_smog else "sin_smog"
        confianza = round(CONFIANZA_MIN + (CONFIANZA_MAX - CONFIANZA_MIN) * rng.betavariate(5, 2), 4)
        p = confianza
        nombre_zona = NOMBRE_CORTO.get(clave, str(clave))
        stats[nombre_zona][0] += 1
        stats[nombre_zona][1] += clase == "smog"
        total_smog += clase == "smog"

        registros.append(
            dict(ts=ts, clase=clase, p=p, confianza=confianza, placa=placa, usuario_id=usuario_id, ub_id=ub_id, disp_id=disp_id)
        )

    # Asignar imágenes en orden cronológico: nunca la misma imagen el mismo día
    # ni entre las últimas N de su clase; entre las válidas, se prefiere la menos usada.
    registros.sort(key=lambda r: r["ts"])
    ventana = {k: min(VENTANA_SIN_REPETIR, max(1, len(v) // 2)) for k, v in pools.items()}
    recientes = {k: [] for k in pools}
    por_dia = defaultdict(set)
    for r in registros:
        pool = pools[r["clase"]]
        dia = r["ts"].date()
        bloqueadas = set(recientes[r["clase"]][-ventana[r["clase"]]:]) | por_dia[dia]
        candidatas = [x for x in pool if x not in bloqueadas] or [x for x in pool if x not in por_dia[dia]] or pool
        minimo = min(usos_img[x] for x in candidatas)
        menos_usadas = [x for x in candidatas if usos_img[x] <= minimo + 1]
        rel = rng_img.choice(menos_usadas)
        r["rel"] = rel
        usos_img[rel] += 1
        recientes[r["clase"]].append(rel)
        por_dia[dia].add(rel)

    # Verificación: sin repeticiones el mismo día ni consecutivas
    repetidas_dia = sum(len(v) for v in por_dia.values()) != len(registros)
    consecutivas = sum(1 for a, b in zip(registros, registros[1:]) if a["rel"] == b["rel"])

    if not dry_run:
        for i, r in enumerate(registros):
            img = Imagen(
                filename_original=f"{PREFIJO}{i:04d}_{Path(r['rel']).name}",
                ruta_archivo=f"{PUBLIC_BASE_URL}/{r['rel']}",
                placa_manual=r["placa"] if con_placas else None,  # por defecto sin placa: se registran a mano en /placas
                fecha_subida=r["ts"] - timedelta(seconds=rng_img.randint(5, 90)),
                usuario_id=r["usuario_id"],
                ubicacion_id=r["ub_id"],
                dispositivo_captura_id=r["disp_id"],
            )
            img.prediccion = Prediccion(
                clase_predicha=r["clase"],
                confianza=r["confianza"],
                p_smog=r["p"],
                fecha_prediccion=r["ts"],
                observacion=None,
            )
            db.add(img)
            if (i + 1) % 200 == 0:
                db.commit()
        db.commit()

    return {
        "cantidad": cantidad,
        "smog": total_smog,
        "zonas": dict(stats),
        "imagenes_distintas": len(usos_img),
        "max_usos_imagen": max(usos_img.values()) if usos_img else 0,
        "min_usos_imagen": min(usos_img.values()) if usos_img else 0,
        "repetidas_mismo_dia": repetidas_dia,
        "consecutivas": consecutivas,
    }


def imprimir(r: dict, dry_run: bool) -> None:
    t, s = r["cantidad"], r["smog"]
    print(f"\n{'[dry-run] ' if dry_run else ''}Registros: {t}  ·  con smog: {s} ({s / t * 100:.1f} %)  ·  sin smog: {t - s}"
          f"  ·  relación ≈ 1:{(t - s) / max(s, 1):.1f}")
    print(f"Imágenes distintas usadas: {r['imagenes_distintas']}  ·  usos por imagen: {r['min_usos_imagen']}–{r['max_usos_imagen']}")
    print(f"Misma imagen el mismo día: {'SÍ' if r['repetidas_mismo_dia'] else 'no'}  ·  imágenes iguales seguidas: {r['consecutivas']}")
    print("Por zona (total · con smog · %):")
    for z, (tot, sm) in sorted(r["zonas"].items(), key=lambda x: -x[1][1] / max(x[1][0], 1)):
        pct = sm / tot * 100 if tot else 0
        nivel = "Alto" if pct > 30 else "Moderado" if pct > 15 else "Bajo"
        print(f"  {z:40} {tot:4} · {sm:4} · {pct:5.1f} %  {nivel}")


def main(argv: Optional[List[str]] = None) -> int:
    ap = argparse.ArgumentParser(description="Carga registros de prueba con imágenes de backend/dataPrueba")
    ap.add_argument("--cantidad", type=int, default=800)
    ap.add_argument("--meses", type=int, default=6)
    ap.add_argument("--semilla", type=int, default=7)
    ap.add_argument("--dry-run", action="store_true", help="No escribe nada; solo muestra el resumen")
    ap.add_argument("--limpiar", action="store_true", help="Borra registros de prueba y demo y termina")
    ap.add_argument("--con-placas", action="store_true", help="Rellena placas ficticias (por defecto quedan vacías)")
    args = ap.parse_args(argv)

    ensure_schema_upgrades(engine)
    db = SessionLocal()
    try:
        if args.limpiar:
            print("Prueba eliminados:", limpiar_prueba(db))
            print("Demo eliminados:", clean_demo(db))
            obsoletas = limpiar_zonas_obsoletas(db)
            if obsoletas:
                print("Zonas/cámaras obsoletas eliminadas:", ", ".join(obsoletas))
            return 0
        if not args.dry_run:
            asignar_ciudades_faltantes(db)
            print("Prueba anteriores eliminados:", limpiar_prueba(db))
            print("Demo anteriores eliminados:", clean_demo(db))
            obsoletas = limpiar_zonas_obsoletas(db)
            if obsoletas:
                print("Zonas/cámaras obsoletas eliminadas:", ", ".join(obsoletas))
        r = generar(db, args.cantidad, args.meses, args.semilla, args.dry_run, args.con_placas)
        imprimir(r, args.dry_run)
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
