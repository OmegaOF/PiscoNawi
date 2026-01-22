import cv2
from ultralytics import YOLO
import time
import os

SAVE_DIR = "captured_cars"
os.makedirs(SAVE_DIR, exist_ok=True)

# Load YOLO model
model = YOLO("yolov8n.pt")

# Use Mac GPU acceleration (M1)
model.to("mps")

cap = cv2.VideoCapture(0)

if not cap.isOpened():
    print("Camera not available")
    exit()

print("Running... Press Q to quit")

last_capture = 0
COOLDOWN = 5

while True:
    ret, frame = cap.read()
    if not ret:
        break

    results = model(frame, conf=0.5, verbose=False)

    detected = False

    for r in results:
        for box in r.boxes:
            cls = int(box.cls[0])
            label = model.names[cls]

            if label in ["car", "bus", "truck", "motorbike"]:
                detected = True
                x1, y1, x2, y2 = map(int, box.xyxy[0])
                cv2.rectangle(frame, (x1, y1), (x2, y2), (0,255,0), 2)
                cv2.putText(frame, label, (x1, y1-10),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0,255,0), 2)

    now = time.time()
    if detected and now - last_capture > COOLDOWN:
        filename = f"{SAVE_DIR}/car_{int(now)}.jpg"
        cv2.imwrite(filename, frame)
        print("Saved:", filename)
        last_capture = now

    cv2.imshow("Car Detector", frame)

    if cv2.waitKey(1) & 0xFF == ord("q"):
        break

cap.release()
cv2.destroyAllWindows()