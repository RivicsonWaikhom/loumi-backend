# ML Model Weights Directory

Place your custom trained model weights here.

Supported options:
1. **PyTorch / Ultralytics YOLOv8/YOLOv9**:
   - Filename: `best.pt` or `pineapple_model.pt`
   - Requirements: `pip install ultralytics` or `pip install torch torchvision`
2. **ONNX Runtime**:
   - Filename: `pineapple_model.onnx` or `model.onnx`
   - Requirements: `pip install onnxruntime`
3. **External Model API Endpoint**:
   - Alternatively, you can keep the model hosted on another server (Colab, HuggingFace, FastAPI) and set:
     `ML_MODEL_ENDPOINT=http://your-server:8000/predict` in `.env`

If no model is installed, the system honestly reports that the custom ML model is not yet connected and never fabricates mock predictions.
