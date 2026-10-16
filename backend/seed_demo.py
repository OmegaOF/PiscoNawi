"""
Genera datos de demostración realistas para los reportes de Pisco Ñawi IA.

Uso (desde backend/):
    python seed_demo.py --count 800 --months 6 [--seed 42] [--dry-run]
    python seed_demo.py --replace --count 800 --months 6   # borra demo previo y vuelve a sembrar
    python seed_demo.py --clean                            # borra solo las filas demo
    python seed_demo.py --purge-reportes-huerfanos         # borra reportes_generados cuyo PDF no existe
    python seed_demo.py --stats                            # resumen de filas demo

Las filas demo se marcan con:
    imagenes.filename_original  LIKE 'demo_%'
    predicciones.observacion    = 'DEMO'
    imagenes.ruta_archivo       termina en '?demo=1' (nunca coincide con una captura real)
"""
from __future__ import annotations

import argparse
import random
import sys
from collections import defaultdict
from datetime import date, datetime, time, timedelta
from pathlib import Path
from typing import Dict, List, Optional

from sqlalchemy import case, func

from db import (
    Ciudad,
    DispositivoCaptura,
    Imagen,
    Prediccion,
    ReporteGenerado,
    SessionLocal,
    engine,
    ensure_schema_upgrades,
    Ubicacion,
    Usuario,
)

BASE_DIR = Path(__file__).resolve().parents[1]
CAPTURAS_DIR = BASE_DIR / "storage" / "capturas"
PUBLIC_BASE_URL = "http://localhost:8000/capturas"
MAX_IMAGE_BYTES = 3 * 1024 * 1024
DEMO_PREFIX = "demo_"
DEMO_OBS = "DEMO"

# ubicacion_id: (peso_volumen, prob_smog_base, dispositivo_id)
ZONAS = {
    1: (0.26, 0.42, 3),  # Cercado centro  -> Cámara Prado
    2: (0.22, 0.34, 2),  # Av. América     -> Cámara Av. América
    3: (0.18, 0.62, 1),  # Quillacollo     -> Cámara Blanco Galindo
    4: (0.14, 0.26, 5),  # Sacaba          -> Cámara Sacaba
    5: (0.10, 0.08, 6),  # Tiquipaya       -> Cámara Tiquipaya
    6: (0.10, 0.18, 1),  # Colcapirhua     -> Cámara Blanco Galindo
}
# Peso de tráfico por franja de media hora (48 franjas: 00:00, 00:30, 01:00, ...).
# Pico de la tarde en 17:30-19:00; valle de media mañana en 10:30-11:30.
FRANJA_MIN = 30
HORA_PESO_MEDIA = [
    0.20, 0.18,  # 00:00  00:30
    0.10, 0.10,  # 01:00  01:30
    0.10, 0.10,  # 02:00  02:30
    0.10, 0.10,  # 03:00  03:30
    0.20, 0.25,  # 04:00  04:30
    0.60, 0.80,  # 05:00  05:30
    1.30, 1.60,  # 06:00  06:30
    2.00, 2.20,  # 07:00  07:30
    2.10, 1.90,  # 08:00  08:30
    1.50, 1.30,  # 09:00  09:30
    1.10, 0.55,  # 10:00  10:30 <- valle
    0.50, 0.60,  # 11:00  11:30 <- valle hasta 11:30
    1.40, 1.50,  # 12:00  12:30
    1.40, 1.30,  # 13:00  13:30
    1.10, 1.10,  # 14:00  14:30
    1.20, 1.30,  # 15:00  15:30
    1.50, 1.70,  # 16:00  16:30
    1.90, 3.20,  # 17:00  17:30 <- pico
    3.40, 3.30,  # 18:00  18:30 <- pico
    2.00, 1.60,  # 19:00  19:30
    1.20, 1.00,  # 20:00  20:30
    0.80, 0.70,  # 21:00  21:30
    0.50, 0.40,  # 22:00  22:30
    0.30, 0.25,  # 23:00  23:30
]
# Compatibilidad: peso por hora entera (suma de sus dos medias horas).
HORA_PESO = [HORA_PESO_MEDIA[2 * h] + HORA_PESO_MEDIA[2 * h + 1] for h in range(24)]
HORA_SMOG_DELTA = {7: .15, 8: .15, 9: .12, 17: .18, 18: .20, 19: .18, 12: .05, 13: .05, 14: .04,
                   0: -.10, 1: -.10, 2: -.10, 3: -.10, 4: -.10, 5: -.05, 10: -.04, 11: -.04}
DIA_PESO = [1.0, 1.0, 1.0, 1.0, 1.1, 0.6, 0.35]  # lunes..domingo
DIA_SMOG_DELTA = {5: -0.05, 6: -0.07}
# Ventana más limpia de la semana: domingo por la tarde (mínimo a las 15:00).
# Clave (dia_semana 0=lunes, hora) -> factor que multiplica la probabilidad de smog.
VENTANA_LIMPIA = {(6, 13): 0.25, (6, 14): 0.10, (6, 15): 0.04, (6, 16): 0.10, (6, 17): 0.30}
# Se refuerza el volumen del domingo en esa franja para que la celda tenga muestras suficientes
# y el "momento más limpio" no lo decida el azar de una celda con 3 registros.
VENTANA_LIMPIA_VOLUMEN = {(6, 13): 6.0, (6, 14): 12.0, (6, 15): 26.0, (6, 16): 12.0, (6, 17): 6.0}
# Probabilidad mínima de smog fuera de la ventana limpia: mantiene las demás franjas
# por encima de cero para que el "momento más limpio" no lo decida el azar.
PROB_SMOG_MINIMA = 0.01
# Ventana más crítica de la semana: miércoles al final de la tarde (pico a las 18:00).
# Clave (dia_semana 0=lunes, hora) -> factor que multiplica la probabilidad de smog de la zona,
# de modo que las zonas limpias siguen siendo las menos contaminadas también en esa franja.
VENTANA_CRITICA = {(2, 17): 1.6, (2, 18): 2.6, (2, 19): 1.6}
# La hora crítica es un embotellamiento en avenidas congestionadas: no afecta a las zonas
# tranquilas, así que solo se aplica donde la probabilidad base de la zona llega a este valor.
VENTANA_CRITICA_BASE_MINIMA = 0.10
# Volumen reforzado para que la franja tenga muestra suficiente y el porcentaje sea estable.
VENTANA_CRITICA_VOLUMEN = {(2, 17): 3.0, (2, 18): 11.0, (2, 19): 3.0}
MES_SMOG_DELTA = {4: -.05, 5: -.02, 6: .02, 7: .06, 8: .08, 9: .05, 10: .0}  # estación seca peor
VOLUMEN_INICIAL, VOLUMEN_FINAL = 0.8, 1.2
CONFIANZA_MIN, CONFIANZA_MAX = 0.60, 0.97

USUARIOS_PESO = {
    "operador@pisco.local": 0.45,
    "admin": 0.20,
    "analista@pisco.local": 0.15,
    "admin@pisco.local": 0.10,
    "dev@pisco.local": 0.10,
}
PROB_PLACA = 0.30
N_PLACAS_FRECUENTES, N_PLACAS_OCASIONALES, N_PLACAS_SUCIAS = 15, 45, 8
IMAGENES_SMOG = ["1.png", "2.png", "3.png", "frame_1769123250.jpg", "frame_1769123255.jpg"]
IMAGENES_SIN_SMOG = ["amarillo.jpg", "vehicle_1769123591.jpg", "vehicle_1769124348.jpg", "vehicle_1776878856.jpg"]
LETRAS_PLACA = "ABCDEFGHJKLMNPRSTUVWXYZ"


def listar_imagenes_disponibles() -> List[str]:
    if not CAPTURAS_DIR.is_dir():
        return []
    out = []
    for p in sorted(CAPTURAS_DIR.iterdir()):
        if p.suffix.lower() not in {".jpg", ".jpeg", ".png"} or " " in p.name:
            continue
        if p.stat().st_size > MAX_IMAGE_BYTES:
            continue
        out.append(p.name)
    return out


def _demo_imagen_ids(db) -> List[int]:
    return [i for (i,) in db.query(Imagen.id).filter(Imagen.filename_original.like("demo\\_%", escape="\\")).all()]


def contar_demo(db) -> int:
    return len(_demo_imagen_ids(db))


def clean_demo(db) -> Dict[str, int]:
    ids = _demo_imagen_ids(db)
    pred = img = 0
    for i in range(0, len(ids), 500):
        chunk = ids[i:i + 500]
        pred += db.query(Prediccion).filter(Prediccion.imagen_id.in_(chunk)).delete(synchronize_session=False)
        img += db.query(Imagen).filter(Imagen.id.in_(chunk)).delete(synchronize_session=False)
    db.commit()
    return {"predicciones": pred, "imagenes": img}


def purge_reportes_huerfanos(db) -> List[int]:
    eliminados = []
    for row in db.query(ReporteGenerado).all():
        p = BASE_DIR / (row.ruta_archivo or "")
        if not row.ruta_archivo or not p.is_file():
            eliminados.append(row.id)
            db.delete(row)
    db.commit()
    return eliminados


def asignar_ciudades_faltantes(db) -> List[int]:
    """Asigna la ciudad más cercana a ubicaciones sin ciudad_id."""
    ciudades = db.query(Ciudad).filter(Ciudad.latitud.isnot(None), Ciudad.longitud.isnot(None)).all()
    if not ciudades:
        return []
    cambiadas = []
    for u in db.query(Ubicacion).filter(Ubicacion.ciudad_id.is_(None)).all():
        lat, lng = float(u.latitud), float(u.longitud)
        c = min(ciudades, key=lambda c: (float(c.latitud) - lat) ** 2 + (float(c.longitud) - lng) ** 2)
        u.ciudad_id = c.id
        cambiadas.append(u.id)
    db.commit()
    return cambiadas


def _gen_placa(rng: random.Random, usadas: set) -> str:
    while True:
        placa = f"{rng.randint(1000, 9999)}{''.join(rng.choices(LETRAS_PLACA, k=3))}"
        if placa not in usadas:
            usadas.add(placa)
            return placa


def run_seed(
    db,
    count: int = 800,
    months: int = 6,
    rng_seed: int = 42,
    imagenes: Optional[List[str]] = None,
    hoy: Optional[date] = None,
    dry_run: bool = False,
) -> dict:
    rng = random.Random(rng_seed)
    hoy = hoy or date.today()
    inicio = hoy - timedelta(days=30 * months)
    ahora = datetime.combine(hoy, datetime.now().time()) if hoy == date.today() else datetime.combine(hoy, time(23, 59, 59))

    ubicaciones = {u.id: u for u in db.query(Ubicacion).all()}
    zone_ids = [z for z in ZONAS if z in ubicaciones]
    if not zone_ids:
        raise ValueError("No hay ubicaciones con id 1-6; carga primero los catálogos.")
    zone_weights = [ZONAS[z][0] for z in zone_ids]

    dispositivos = {d.id: d for d in db.query(DispositivoCaptura).all()}
    activo_default = next((d.id for d in dispositivos.values() if d.activo), None)

    usuarios = {u.username: u.id for u in db.query(Usuario).all()}
    user_pairs = [(usuarios[n], w) for n, w in USUARIOS_PESO.items() if n in usuarios]
    user_ids = [u for u, _ in user_pairs] or [None]
    user_weights = [w for _, w in user_pairs] or [1.0]

    if not dry_run:
        cambiadas = asignar_ciudades_faltantes(db)
        if cambiadas:
            print(f"Ubicaciones con ciudad asignada: {cambiadas}")

    archivos = imagenes if imagenes is not None else listar_imagenes_disponibles()
    if not archivos:
        raise ValueError(f"No hay imágenes utilizables en {CAPTURAS_DIR}")
    pool_smog = [a for a in archivos if a in IMAGENES_SMOG] or archivos
    pool_sin = [a for a in archivos if a in IMAGENES_SIN_SMOG] or archivos

    days = [inicio + timedelta(days=i) for i in range((hoy - inicio).days + 1)]
    n_days = len(days)
    day_weights = [
        DIA_PESO[d.weekday()] * (VOLUMEN_INICIAL + (VOLUMEN_FINAL - VOLUMEN_INICIAL) * idx / max(n_days - 1, 1))
        for idx, d in enumerate(days)
    ]
    dias = rng.choices(days, day_weights, k=count)

    usadas: set = set()
    placas_frec = [_gen_placa(rng, usadas) for _ in range(N_PLACAS_FRECUENTES)]
    placas_ocas = [_gen_placa(rng, usadas) for _ in range(N_PLACAS_OCASIONALES)]
    placas_sucias = set(placas_frec[:N_PLACAS_SUCIAS])
    placas_todas = placas_frec + placas_ocas
    placas_pesos = [4] * len(placas_frec) + [1] * len(placas_ocas)

    stats_zona = defaultdict(lambda: [0, 0])
    stats_disp = defaultdict(lambda: [0, 0])
    placas_vistas = defaultdict(int)
    min_ts = max_ts = None

    for i, dia in enumerate(dias):
        pesos_franja = HORA_PESO_MEDIA
        refuerzo = VENTANA_LIMPIA_VOLUMEN if dia.weekday() == 6 else VENTANA_CRITICA_VOLUMEN
        if any(d == dia.weekday() for d, _ in refuerzo):
            pesos_franja = [
                w * refuerzo.get((dia.weekday(), (f * FRANJA_MIN) // 60), 1.0)
                for f, w in enumerate(HORA_PESO_MEDIA)
            ]
        franja = rng.choices(range(len(HORA_PESO_MEDIA)), pesos_franja)[0]
        hora, minuto = divmod(franja * FRANJA_MIN + rng.randint(0, FRANJA_MIN - 1), 60)
        ts = datetime.combine(dia, time(hora, minuto, rng.randint(0, 59)))
        if ts > ahora:
            ts -= timedelta(days=1)
        hora = ts.hour

        ub_id = rng.choices(zone_ids, zone_weights)[0]
        disp_id = ZONAS[ub_id][2] if ZONAS[ub_id][2] in dispositivos else activo_default
        usuario_id = rng.choices(user_ids, user_weights)[0]

        placa = None
        if rng.random() < PROB_PLACA:
            placa = rng.choices(placas_todas, placas_pesos)[0]

        prob = (
            ZONAS[ub_id][1]
            + HORA_SMOG_DELTA.get(hora, 0)
            + DIA_SMOG_DELTA.get(ts.weekday(), 0)
            + MES_SMOG_DELTA.get(ts.month, 0)
            + rng.gauss(0, 0.03)
        )
        clave_hora = (ts.weekday(), hora)
        factor_limpio = VENTANA_LIMPIA.get(clave_hora, 1.0)
        prob_critica = VENTANA_CRITICA.get(clave_hora) if ZONAS[ub_id][1] >= VENTANA_CRITICA_BASE_MINIMA else None
        if factor_limpio < 1.0:
            prob = min(prob * factor_limpio, 0.95)
        elif prob_critica is not None:
            prob = min(prob * prob_critica, 0.95)
        else:
            if placa in placas_sucias:
                prob = 0.85
            prob = min(max(prob, PROB_SMOG_MINIMA), 0.95)
        es_smog = rng.random() < prob

        clase = "smog" if es_smog else "sin_smog"
        # Sistema binario: el único número es la confianza de la predicción.
        confianza = round(CONFIANZA_MIN + (CONFIANZA_MAX - CONFIANZA_MIN) * rng.betavariate(5, 2), 4)
        p = confianza
        fname = rng.choice(pool_smog if es_smog else pool_sin)

        stats_zona[ub_id][0] += 1
        stats_zona[ub_id][1] += clase == "smog"
        stats_disp[disp_id][0] += 1
        stats_disp[disp_id][1] += clase == "smog"
        if placa:
            placas_vistas[placa] += 1
        min_ts = ts if min_ts is None or ts < min_ts else min_ts
        max_ts = ts if max_ts is None or ts > max_ts else max_ts

        if dry_run:
            continue
        img = Imagen(
            filename_original=f"{DEMO_PREFIX}{i:04d}_{fname}",
            ruta_archivo=f"{PUBLIC_BASE_URL}/{fname}?demo=1",
            placa_manual=placa,
            fecha_subida=ts - timedelta(seconds=rng.randint(5, 90)),
            usuario_id=usuario_id,
            ubicacion_id=ub_id,
            dispositivo_captura_id=disp_id,
        )
        img.prediccion = Prediccion(
            clase_predicha=clase,
            confianza=confianza,
            p_smog=p,
            fecha_prediccion=ts,
            observacion=DEMO_OBS,
        )
        db.add(img)
        if (i + 1) % 200 == 0:
            db.commit()

    if not dry_run:
        db.commit()

    def _fmt(d):
        return {k: (t, s, round(s / t * 100, 1) if t else 0.0) for k, (t, s) in sorted(d.items(), key=lambda x: str(x[0]))}

    return {
        "insertados": 0 if dry_run else count,
        "simulados": count,
        "rango": (min_ts, max_ts),
        "por_zona": _fmt(stats_zona),
        "por_dispositivo": _fmt(stats_disp),
        "placas_distintas": len(placas_vistas),
        "placas_3_o_mas": sum(1 for v in placas_vistas.values() if v >= 3),
    }


def stats_demo(db) -> dict:
    rows = (
        db.query(Imagen.ubicacion_id, func.count(Prediccion.id), func.sum(case((Prediccion.clase_predicha == "smog", 1), else_=0)))
        .join(Prediccion, Prediccion.imagen_id == Imagen.id)
        .filter(Prediccion.observacion == DEMO_OBS)
        .group_by(Imagen.ubicacion_id)
        .all()
    )
    return {u: (int(t), int(s or 0)) for u, t, s in rows}


def _print_stats(stats: dict) -> None:
    print(f"Filas: {stats['insertados']} insertadas ({stats['simulados']} simuladas)")
    print(f"Rango: {stats['rango'][0]} -> {stats['rango'][1]}")
    print("Por zona (total, smog, %):")
    for k, v in stats["por_zona"].items():
        print(f"  U{k}: {v}")
    print("Por dispositivo (total, smog, %):")
    for k, v in stats["por_dispositivo"].items():
        print(f"  D{k}: {v}")
    print(f"Placas distintas: {stats['placas_distintas']} · con 3+ detecciones: {stats['placas_3_o_mas']}")


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Datos demo para reportes de Pisco Ñawi IA")
    parser.add_argument("--count", type=int, default=800)
    parser.add_argument("--months", type=int, default=6)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--replace", action="store_true")
    parser.add_argument("--clean", action="store_true")
    parser.add_argument("--purge-reportes-huerfanos", action="store_true")
    parser.add_argument("--stats", action="store_true")
    args = parser.parse_args(argv)

    applied = ensure_schema_upgrades(engine)
    if applied:
        print(f"Columnas agregadas: {applied}")
    db = SessionLocal()
    try:
        if args.stats:
            for u, (t, s) in sorted(stats_demo(db).items()):
                print(f"U{u}: total={t} smog={s} ({round(s / t * 100, 1) if t else 0}%)")
            return 0
        if args.purge_reportes_huerfanos:
            ids = purge_reportes_huerfanos(db)
            print(f"Reportes huérfanos eliminados: {ids}")
            if not (args.clean or args.replace):
                return 0
        if args.clean:
            print(f"Filas demo eliminadas: {clean_demo(db)}")
            return 0
        existentes = contar_demo(db)
        if existentes and not args.dry_run:
            if not args.replace:
                print(f"Ya existen {existentes} filas demo; usa --replace o --clean.")
                return 1
            print(f"Filas demo eliminadas: {clean_demo(db)}")
        stats = run_seed(db, args.count, args.months, args.seed, dry_run=args.dry_run)
        _print_stats(stats)
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
