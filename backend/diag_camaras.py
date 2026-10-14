"""Diagnóstico de cámaras. Uso:  venv/bin/python diag_camaras.py"""
import os, sys, platform
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__))))
import cv2

print("Sistema:", platform.system(), platform.release(), "| OpenCV:", cv2.__version__)
candidatos = [("ANY", cv2.CAP_ANY)]
if sys.platform.startswith("win"):
    candidatos = [("DSHOW", cv2.CAP_DSHOW), ("MSMF", cv2.CAP_MSMF), ("ANY", cv2.CAP_ANY)]
elif sys.platform == "darwin":
    candidatos = [("AVFOUNDATION", cv2.CAP_AVFOUNDATION), ("ANY", cv2.CAP_ANY)]

for nombre, backend in candidatos:
    print(f"\n--- {nombre} ---")
    for i in range(6):
        try:
            cap = cv2.VideoCapture(i, backend)
        except Exception as e:
            print(f"  índice {i}: excepción {e}")
            continue
        if not cap.isOpened():
            cap.release()
            print(f"  índice {i}: no abre")
            continue
        leyo = False
        for _ in range(5):
            ok, frame = cap.read()
            if ok and frame is not None:
                leyo = True
                print(f"  índice {i}: ABRE y entrega {frame.shape[1]}x{frame.shape[0]}")
                break
        if not leyo:
            print(f"  índice {i}: abre pero NO entrega imagen")
        cap.release()
