import os
from dotenv import load_dotenv

load_dotenv()

CNN_MODEL_STEP_INFO = os.getenv("CNN_MODEL_STEP_INFO")
CNN_MODEL_STEP_URL = os.getenv("CNN_MODEL_STEP_URL")
CNN_MODEL_STEP_VERSION = os.getenv("CNN_MODEL_STEP_VERSION")
