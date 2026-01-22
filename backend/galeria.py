from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import os
import glob
from pydantic import BaseModel

from auth import get_current_user
from db import Usuario

router = APIRouter()

CAPTURA_DIR = "/storage/capturas"

class GalleryImage(BaseModel):
    filename: str
    filepath: str
    timestamp: datetime
    size: int

@router.get("/imagenes", response_model=List[GalleryImage])
async def listar_galeria_imagenes(
    current_user: Usuario = Depends(get_current_user),
    fecha_desde: Optional[datetime] = Query(None, description="Fecha desde (YYYY-MM-DD)"),
    fecha_hasta: Optional[datetime] = Query(None, description="Fecha hasta (YYYY-MM-DD)")
):
    if not os.path.exists(CAPTURA_DIR):
        return []

    # Get all image files from captura directory
    image_extensions = ['*.jpg', '*.jpeg', '*.png', '*.webp']
    image_files = []

    for ext in image_extensions:
        image_files.extend(glob.glob(os.path.join(CAPTURA_DIR, ext)))

    gallery_images = []
    for filepath in sorted(image_files, key=os.path.getmtime, reverse=True):
        timestamp = datetime.fromtimestamp(os.path.getmtime(filepath))

        # Apply date filters if provided
        if fecha_desde and timestamp.date() < fecha_desde.date():
            continue
        if fecha_hasta and timestamp.date() > fecha_hasta.date():
            continue

        filename = os.path.basename(filepath)
        size = os.path.getsize(filepath)

        gallery_images.append(GalleryImage(
            filename=filename,
            filepath=filepath,
            timestamp=timestamp,
            size=size
        ))

    return gallery_images