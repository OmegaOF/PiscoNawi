from datetime import date, datetime

import pytest

import seed_demo
from db import Ciudad, DispositivoCaptura, Imagen, Pais, Prediccion, Provincia, ReporteGenerado, Ubicacion, Usuario


def _catalogos(db, ciudad_en_ub1=True):
    pais = Pais(nombre="Bolivia")
    db.add(pais)
    db.flush()
    prov = Provincia(nombre="Cercado", pais_id=pais.id)
    db.add(prov)
    db.flush()
    c = Ciudad(nombre="Cochabamba", provincia_id=prov.id, latitud=-17.39, longitud=-66.15)
    db.add(c)
    db.flush()
    for i in range(1, 7):
        db.add(Ubicacion(id=i, latitud=-17.4 + i * 0.01, longitud=-66.15, ciudad_id=c.id if (ciudad_en_ub1 or i != 1) else None))
    for i in (1, 2, 3, 5, 6):
        db.add(DispositivoCaptura(id=i, nombre_dispositivo=f"Cam {i}", activo=True))
    for u in ("operador@pisco.local", "admin"):
        db.add(Usuario(nombre=u, username=u, password_hash="x"))
    db.commit()
    return c


def test_run_seed_inserta_y_es_consistente(db):
    _catalogos(db)
    seed_demo.run_seed(db, count=120, months=2, rng_seed=7, imagenes=["a.jpg", "b.jpg"], hoy=date(2026, 10, 9))
    preds = db.query(Prediccion).filter(Prediccion.observacion == "DEMO").all()
    assert len(preds) == 120
    for p in preds:
        img = p.imagen
        assert (p.p_smog >= 0.5) == (p.clase_predicha == "smog")
        assert abs(p.confianza - (p.p_smog if p.clase_predicha == "smog" else 1 - p.p_smog)) < 1e-6
        assert img.fecha_subida <= p.fecha_prediccion
        assert img.ruta_archivo.endswith("?demo=1")
        assert img.filename_original.startswith("demo_")
        assert p.fecha_prediccion >= datetime(2026, 8, 10)


def test_run_seed_determinista(db):
    _catalogos(db)
    a = seed_demo.run_seed(db, count=50, months=1, rng_seed=3, imagenes=["a.jpg"], hoy=date(2026, 10, 9), dry_run=True)
    b = seed_demo.run_seed(db, count=50, months=1, rng_seed=3, imagenes=["a.jpg"], hoy=date(2026, 10, 9), dry_run=True)
    assert a == b
    assert db.query(Imagen).count() == 0


def test_clean_demo_no_toca_filas_reales(db):
    _catalogos(db)
    real = Imagen(filename_original="real.jpg", ruta_archivo="http://x/real.jpg", fecha_subida=datetime(2026, 1, 1))
    real.prediccion = Prediccion(clase_predicha="smog", confianza=0.9, p_smog=0.9, fecha_prediccion=datetime(2026, 1, 1))
    db.add(real)
    db.commit()
    seed_demo.run_seed(db, count=30, months=1, rng_seed=1, imagenes=["a.jpg"], hoy=date(2026, 10, 9))
    assert seed_demo.contar_demo(db) == 30
    seed_demo.clean_demo(db)
    assert seed_demo.contar_demo(db) == 0
    assert db.query(Imagen).count() == 1 and db.query(Prediccion).count() == 1


def test_asigna_ciudad_a_ubicacion_sin_ciudad(db):
    c = _catalogos(db, ciudad_en_ub1=False)
    seed_demo.run_seed(db, count=5, months=1, rng_seed=1, imagenes=["a.jpg"], hoy=date(2026, 10, 9))
    assert db.query(Ubicacion).get(1).ciudad_id == c.id


def test_purge_reportes_huerfanos(db, monkeypatch, tmp_path):
    monkeypatch.setattr(seed_demo, "BASE_DIR", tmp_path)
    u = Usuario(nombre="x", username="x", password_hash="x")
    db.add(u)
    db.commit()
    (tmp_path / "ok.pdf").write_bytes(b"x")
    ok = ReporteGenerado(nombre_reporte="a", usuario_id=u.id, ruta_archivo="ok.pdf", fecha_generado=datetime(2026, 1, 1))
    mal = ReporteGenerado(nombre_reporte="b", usuario_id=u.id, ruta_archivo="/reportes/no.pdf", fecha_generado=datetime(2026, 1, 1))
    db.add_all([ok, mal])
    db.commit()
    assert seed_demo.purge_reportes_huerfanos(db) == [mal.id]
    assert db.query(ReporteGenerado).count() == 1
