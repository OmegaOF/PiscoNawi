from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime, date

from services.cnn_queue import start_queue, get_status
from modules.roles.roles import require_roles, require_internal_user
from db import get_db, Usuario, Imagen, Prediccion, Ubicacion, Ciudad, DispositivoCaptura
router = APIRouter()


class ProcesarCnnBody(BaseModel):
    lat: float
    lng: float


class AnalisisItem(BaseModel):
    id: int
    imagen_id: int
    filename_original: str
    ruta_archivo: str
    placa_manual: Optional[str]
    clase_predicha: str
    confianza: float
    p_smog: float
    observacion: Optional[str]
    fecha_prediccion: str


@router.get("/emisiones", response_model=List[AnalisisItem])
async def obtener_analisis_emisiones(
    current_user: Usuario = Depends(require_internal_user),
        db: Session = Depends(get_db),
):
    results = (
        db.query(
            Imagen.id,
            Imagen.filename_original,
            Imagen.ruta_archivo,
            Imagen.placa_manual,
            Prediccion.clase_predicha,
            Prediccion.confianza,
            Prediccion.p_smog,
            Prediccion.observacion,
            Prediccion.fecha_prediccion,
        )
        .join(Prediccion, Imagen.id == Prediccion.imagen_id)
        .all()
    )

    analisis_items: List[AnalisisItem] = []
    for row in results:
        analisis_items.append(
            AnalisisItem(
                id=row.id,
                imagen_id=row.id,
                filename_original=row.filename_original,
                ruta_archivo=row.ruta_archivo,
                placa_manual=row.placa_manual,
                clase_predicha=row.clase_predicha,
                confianza=float(row.confianza),
                p_smog=float(row.p_smog),
                observacion=row.observacion,
                fecha_prediccion=row.fecha_prediccion.strftime("%Y-%m-%d %H:%M:%S"),
            )
        )
    return analisis_items


@router.post("/analizar/{imagen_id}")
async def analizar_con_ia(
    imagen_id: int,
    current_user: Usuario = Depends(require_internal_user),
        db: Session = Depends(get_db),
):
    imagen = db.query(Imagen).filter(Imagen.id == imagen_id).first()
    if not imagen:
        raise HTTPException(status_code=404, detail="Imagen no encontrada")

    prediccion = db.query(Prediccion).filter(Prediccion.imagen_id == imagen_id).first()
    if not prediccion:
        raise HTTPException(status_code=404, detail="Predicción no encontrada para esta imagen")

    from backend.services.openai_service import analizar_imagen_openai

    try:
        resultado = await analizar_imagen_openai(imagen.ruta_archivo)

        prediccion.clase_predicha = "smog" if resultado["smog_visible"] else "sin_smog"
        prediccion.confianza = resultado["nivel_confianza"] / 100.0
        prediccion.p_smog = resultado["porcentaje_smog"] / 100.0
        prediccion.observacion = resultado["descripcion_corta"]

        if resultado.get("placa") and resultado["placa"] != "undefined":
            imagen.placa_manual = resultado["placa"]

        db.commit()
        return {"message": "Análisis completado y actualizado", "resultado": resultado}

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error en el análisis con IA: {str(e)}")


async def _reverse_geocode_nombre(lat: float, lng: float) -> Optional[str]:
    """Obtiene dirección desde Nominatim (OpenStreetMap)."""
    try:
        import httpx
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(
                "https://nominatim.openstreetmap.org/reverse",
                params={"lat": lat, "lon": lng, "format": "json"},
                headers={"User-Agent": "PiscoNawi-App/1.0"},
            )
            if r.status_code != 200:
                return None
            data = r.json()
            return data.get("display_name") or None
    except Exception:
        return None

def _resolver_ciudad_id(db: Session, lat: float, lng: float) -> Optional[int]:
    """Resuelve ciudad_id automáticamente usando la ciudad más cercana con coordenadas válidas."""
    row = (
        db.query(Ciudad.id)
        .filter(Ciudad.latitud.isnot(None), Ciudad.longitud.isnot(None))
        .order_by(
            func.pow(Ciudad.latitud - lat, 2) + func.pow(Ciudad.longitud - lng, 2)
        )
        .first()
    )
    return row.id if row else None


def _resolver_dispositivo_id(db: Session) -> Optional[int]:
    """Obtiene dispositivo por defecto (activo primero, si no hay, el primero existente)."""
    activo = (
        db.query(DispositivoCaptura.id)
        .filter(DispositivoCaptura.activo.is_(True))
        .order_by(DispositivoCaptura.id.asc())
        .first()
    )
    if activo:
        return activo.id

    fallback = db.query(DispositivoCaptura.id).order_by(DispositivoCaptura.id.asc()).first()
    return fallback.id if fallback else None



@router.post("/procesar-cnn")
async def procesar_cnn(
    current_user: Usuario = Depends(require_internal_user),
        db: Session = Depends(get_db),
    body: ProcesarCnnBody = Body(...),
):
    # ✅ SOLO direccion (sin nombre)
    direccion = await _reverse_geocode_nombre(body.lat, body.lng)
    ciudad_id = _resolver_ciudad_id(db, body.lat, body.lng)
    dispositivo_id = _resolver_dispositivo_id(db)

    ub = Ubicacion(
        latitud=body.lat,
        longitud=body.lng,
        direccion=direccion.strip() if direccion else None,
        ciudad_id=ciudad_id,
    )

    db.add(ub)
    db.commit()
    db.refresh(ub)

    start_queue(ubicacion_id=ub.id, user_id=current_user.id, dispositivo_id=dispositivo_id)
    return {
        "message": "Procesamiento CNN iniciado (FIFO 1 por 1)",
        "ubicacion_id": ub.id
    }


@router.get("/estado-cnn")
async def estado_cnn(current_user: Usuario = Depends(require_internal_user)):
    return get_status()


class BulkAnalysisResult(BaseModel):
    processed_count: int
    success_count: int
    failed_count: int
    errors: List[str]



class ImagenProcesadaItem(BaseModel):
    imagen_id: int
    ruta_archivo: str
    fecha_subida: Optional[str]
    ubicacion_id: Optional[int]
    dispositivo_captura_id: Optional[int]
    clase_predicha: Optional[str]
    p_smog: Optional[float]


class UbicacionItem(BaseModel):
    id: int
    latitud: float
    longitud: float
    direccion: Optional[str]
    ciudad_id: Optional[int]


class PrediccionItem(BaseModel):
    id: int
    imagen_id: int
    clase_predicha: str
    confianza: float
    p_smog: float
    fecha_prediccion: Optional[str]


class AnalisisDispositivoItem(BaseModel):
    dispositivo_id: int
    nombre_dispositivo: str
    total_predicciones: int
    promedio_p_smog: float


class PrediccionUpdate(BaseModel):
    clase_predicha: Optional[str] = None
    confianza: Optional[float] = None
    p_smog: Optional[float] = None
    observacion: Optional[str] = None


class UbicacionUpdate(BaseModel):
    latitud: Optional[float] = None
    longitud: Optional[float] = None
    direccion: Optional[str] = None
    ciudad_id: Optional[int] = None


class ImagenUpdate(BaseModel):
    placa_manual: Optional[str] = None
    ubicacion_id: Optional[int] = None
    dispositivo_captura_id: Optional[int] = None


@router.post("/analizar-todas-hoy", response_model=BulkAnalysisResult)
async def analizar_todas_imagenes_hoy(
    current_user: Usuario = Depends(require_internal_user),
        db: Session = Depends(get_db)
):
    today = date.today()
    start_of_day = datetime.combine(today, datetime.min.time())

    images_with_predictions = db.query(Imagen).join(Prediccion).filter(
        Imagen.fecha_subida >= start_of_day
    ).all()

    if not images_with_predictions:
        return BulkAnalysisResult(
            processed_count=0,
            success_count=0,
            failed_count=0,
            errors=["No hay imágenes para analizar hoy"]
        )

    processed_count = 0
    success_count = 0
    failed_count = 0
    errors = []

    from services.openai_service import analizar_imagen_openai

    for imagen in images_with_predictions:
        processed_count += 1
        try:
            prediccion = db.query(Prediccion).filter(Prediccion.imagen_id == imagen.id).first()
            if not prediccion:
                failed_count += 1
                errors.append(f"Predicción no encontrada para imagen {imagen.id}")
                continue

            resultado = await analizar_imagen_openai(imagen.ruta_archivo)

            prediccion.clase_predicha = "smog" if resultado["smog_visible"] else "sin_smog"
            prediccion.confianza = resultado["nivel_confianza"] / 100.0
            prediccion.p_smog = resultado["porcentaje_smog"] / 100.0
            prediccion.observacion = resultado["descripcion_corta"]
            prediccion.fecha_prediccion = func.now()

            if resultado.get("placa") and resultado["placa"] != "undefined":
                imagen.placa_manual = resultado["placa"]

            success_count += 1

        except Exception as e:
            failed_count += 1
            error_msg = str(e) if str(e) else f"Error desconocido (tipo: {type(e).__name__})"
            errors.append(f"Error procesando imagen {imagen.id}: {error_msg}")
            db.rollback()
            continue

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error guardando cambios: {str(e)}")

    return BulkAnalysisResult(
        processed_count=processed_count,
        success_count=success_count,
        failed_count=failed_count,
        errors=errors
    )

    @router.get("/imagenes", response_model=List[ImagenProcesadaItem])
    async def listar_imagenes_procesadas(
            fecha_desde: Optional[str] = None,
            fecha_hasta: Optional[str] = None,
            ubicacion_id: Optional[int] = None,
            clase: Optional[str] = None,
            dispositivo_id: Optional[int] = None,
            user: Usuario = Depends(
                require_roles(["Usuario analista", "Administrador", "Constructor del sistema"])),
            db: Session = Depends(get_db),
    ):
        q = db.query(Imagen, Prediccion).outerjoin(Prediccion, Prediccion.imagen_id == Imagen.id)
        if fecha_desde:
            q = q.filter(Imagen.fecha_subida >= datetime.fromisoformat(fecha_desde))
        if fecha_hasta:
            q = q.filter(Imagen.fecha_subida <= datetime.fromisoformat(fecha_hasta))
        if ubicacion_id is not None:
            q = q.filter(Imagen.ubicacion_id == ubicacion_id)
        if clase:
            q = q.filter(Prediccion.clase_predicha == clase)
        if dispositivo_id is not None:
            q = q.filter(Imagen.dispositivo_captura_id == dispositivo_id)

        rows = q.order_by(Imagen.id.desc()).all()
        return [
            ImagenProcesadaItem(
                imagen_id=img.id,
                ruta_archivo=img.ruta_archivo,
                fecha_subida=img.fecha_subida.strftime("%Y-%m-%d %H:%M:%S") if img.fecha_subida else None,
                ubicacion_id=img.ubicacion_id,
                dispositivo_captura_id=img.dispositivo_captura_id,
                clase_predicha=pred.clase_predicha if pred else None,
                p_smog=float(pred.p_smog) if pred else None,
            )
            for img, pred in rows
        ]

        @router.get("/predicciones", response_model=List[PrediccionItem])
        async def listar_predicciones(
                user: Usuario = Depends(
                    require_roles(["Usuario analista", "Administrador", "Constructor del sistema"])),
                db: Session = Depends(get_db),
        ):
            rows = db.query(Prediccion).order_by(Prediccion.id.desc()).all()
            return [
                PrediccionItem(
                    id=r.id,
                    imagen_id=r.imagen_id,
                    clase_predicha=r.clase_predicha,
                    confianza=float(r.confianza),
                    p_smog=float(r.p_smog),
                    fecha_prediccion=r.fecha_prediccion.strftime("%Y-%m-%d %H:%M:%S") if r.fecha_prediccion else None,
                )
                for r in rows
            ]

            @router.get("/ubicaciones", response_model=List[UbicacionItem])
            async def listar_ubicaciones(
                    user: Usuario = Depends(require_roles(["Administrador", "Constructor del sistema"])),
                    db: Session = Depends(get_db),
            ):
                rows = db.query(Ubicacion).order_by(Ubicacion.id.desc()).all()
                return [
                    UbicacionItem(
                        id=r.id,
                        latitud=float(r.latitud),
                        longitud=float(r.longitud),
                        direccion=r.direccion,
                        ciudad_id=r.ciudad_id,
                    )
                    for r in rows
                ]

            @router.get("/por-dispositivo", response_model=List[AnalisisDispositivoItem])
            async def analisis_por_dispositivo(
                    user: Usuario = Depends(
                        require_roles(["Usuario analista", "Administrador", "Constructor del sistema"])),
                    db: Session = Depends(get_db),
            ):
                rows = (
                    db.query(
                        DispositivoCaptura.id,
                        DispositivoCaptura.nombre_dispositivo,
                        func.count(Prediccion.id).label("total"),
                        func.avg(Prediccion.p_smog).label("avg_p_smog"),
                    )
                    .outerjoin(Imagen, Imagen.dispositivo_captura_id == DispositivoCaptura.id)
                    .outerjoin(Prediccion, Prediccion.imagen_id == Imagen.id)
                    .group_by(DispositivoCaptura.id, DispositivoCaptura.nombre_dispositivo)
                    .order_by(DispositivoCaptura.id.asc())
                    .all()
                )
                return [
                    AnalisisDispositivoItem(
                        dispositivo_id=r.id,
                        nombre_dispositivo=r.nombre_dispositivo,
                        total_predicciones=int(r.total or 0),
                        promedio_p_smog=float(r.avg_p_smog or 0),
                    )
                    for r in rows
                ]

            @router.put("/predicciones/{prediccion_id}", response_model=PrediccionItem)
            async def actualizar_prediccion(
                    prediccion_id: int,
                    payload: PrediccionUpdate,
                    user: Usuario = Depends(require_roles(["Administrador", "Constructor del sistema"])),
                    db: Session = Depends(get_db),
            ):
                item = db.query(Prediccion).filter(Prediccion.id == prediccion_id).first()
                if not item:
                    raise HTTPException(status_code=404, detail="Predicción no encontrada")

                if payload.clase_predicha is not None:
                    item.clase_predicha = payload.clase_predicha
                if payload.confianza is not None:
                    item.confianza = payload.confianza
                if payload.p_smog is not None:
                    item.p_smog = payload.p_smog
                if payload.observacion is not None:
                    item.observacion = payload.observacion

                db.commit()
                db.refresh(item)
                return PrediccionItem(
                    id=item.id,
                    imagen_id=item.imagen_id,
                    clase_predicha=item.clase_predicha,
                    confianza=float(item.confianza),
                    p_smog=float(item.p_smog),
                    fecha_prediccion=item.fecha_prediccion.strftime(
                        "%Y-%m-%d %H:%M:%S") if item.fecha_prediccion else None,
                )

            @router.put("/ubicaciones/{ubicacion_id}", response_model=UbicacionItem)
            async def actualizar_ubicacion(
                    ubicacion_id: int,
                    payload: UbicacionUpdate,
                    user: Usuario = Depends(require_roles(["Administrador", "Constructor del sistema"])),
                    db: Session = Depends(get_db),
            ):
                item = db.query(Ubicacion).filter(Ubicacion.id == ubicacion_id).first()
                if not item:
                    raise HTTPException(status_code=404, detail="Ubicación no encontrada")

                if payload.latitud is not None:
                    item.latitud = payload.latitud
                if payload.longitud is not None:
                    item.longitud = payload.longitud
                if payload.direccion is not None:
                    item.direccion = payload.direccion
                if payload.ciudad_id is not None:
                    item.ciudad_id = payload.ciudad_id

            db.commit()
            db.refresh(item)
            return UbicacionItem(
                id=item.id,
                latitud=float(item.latitud),
                longitud=float(item.longitud),
                direccion=item.direccion,
                ciudad_id=item.ciudad_id,
            )

            @router.put("/imagenes/{imagen_id}", response_model=ImagenProcesadaItem)
            async def actualizar_imagen(
                    imagen_id: int,
                    payload: ImagenUpdate,
                    user: Usuario = Depends(require_roles(["Administrador", "Constructor del sistema"])),
                    db: Session = Depends(get_db),
            ):
                item = db.query(Imagen).filter(Imagen.id == imagen_id).first()
                if not item:
                    raise HTTPException(status_code=404, detail="Imagen no encontrada")

            if payload.placa_manual is not None:
                item.placa_manual = payload.placa_manual
            if payload.ubicacion_id is not None:
                item.ubicacion_id = payload.ubicacion_id
            if payload.dispositivo_captura_id is not None:
                item.dispositivo_captura_id = payload.dispositivo_captura_id
            db.commit()
            db.refresh(item)
            pred = db.query(Prediccion).filter(Prediccion.imagen_id == item.id).first()
            return ImagenProcesadaItem(
                imagen_id=item.id,
                ruta_archivo=item.ruta_archivo,
                fecha_subida=item.fecha_subida.strftime("%Y-%m-%d %H:%M:%S") if item.fecha_subida else None,
                ubicacion_id=item.ubicacion_id,
                dispositivo_captura_id=item.dispositivo_captura_id,
                clase_predicha=pred.clase_predicha if pred else None,
                p_smog=float(pred.p_smog) if pred else None,
            )

        @router.delete("/imagenes/{imagen_id}")
        async def eliminar_imagen(
                imagen_id: int,
                user: Usuario = Depends(require_roles(["Administrador"])),
                db: Session = Depends(get_db),
        ):
            item = db.query(Imagen).filter(Imagen.id == imagen_id).first()
            if not item:
                raise HTTPException(status_code=404, detail="Imagen no encontrada")

            pred = db.query(Prediccion).filter(Prediccion.imagen_id == item.id).first()
            if pred:
                db.delete(pred)
            db.delete(item)
            db.commit()
            return {"ok": True, "message": "Imagen eliminada"}
