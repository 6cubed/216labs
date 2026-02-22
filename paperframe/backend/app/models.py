import os
import logging
import numpy as np
import torch
from PIL import Image
from segment_anything import SamAutomaticMaskGenerator, sam_model_registry
from transformers import BlipProcessor, BlipForConditionalGeneration

logger = logging.getLogger(__name__)

SAM_CHECKPOINT = os.environ.get("SAM_CHECKPOINT", "/models/sam_vit_b_01ec64.pth")
SAM_MODEL_TYPE = os.environ.get("SAM_MODEL_TYPE", "vit_b")
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

_sam_generator: SamAutomaticMaskGenerator | None = None
_blip_processor: BlipProcessor | None = None
_blip_model: BlipForConditionalGeneration | None = None


def get_device():
    return DEVICE


def load_sam():
    global _sam_generator
    if _sam_generator is not None:
        return _sam_generator

    logger.info("Loading SAM model (%s) on %s …", SAM_MODEL_TYPE, DEVICE)

    if not os.path.exists(SAM_CHECKPOINT):
        logger.info("Downloading SAM checkpoint …")
        import urllib.request
        os.makedirs(os.path.dirname(SAM_CHECKPOINT), exist_ok=True)
        urllib.request.urlretrieve(
            "https://dl.fbaipublicfiles.com/segment_anything/sam_vit_b_01ec64.pth",
            SAM_CHECKPOINT,
        )

    sam = sam_model_registry[SAM_MODEL_TYPE](checkpoint=SAM_CHECKPOINT)
    sam.to(device=DEVICE)
    _sam_generator = SamAutomaticMaskGenerator(
        sam,
        points_per_side=16,
        pred_iou_thresh=0.86,
        stability_score_thresh=0.92,
        min_mask_region_area=500,
    )
    logger.info("SAM loaded.")
    return _sam_generator


def load_blip():
    global _blip_processor, _blip_model
    if _blip_model is not None:
        return _blip_processor, _blip_model

    logger.info("Loading BLIP captioning model on %s …", DEVICE)
    model_name = "Salesforce/blip-image-captioning-base"
    _blip_processor = BlipProcessor.from_pretrained(model_name)
    _blip_model = BlipForConditionalGeneration.from_pretrained(model_name)
    _blip_model.to(DEVICE)
    _blip_model.eval()
    logger.info("BLIP loaded.")
    return _blip_processor, _blip_model


def segment_image(image: np.ndarray) -> list[dict]:
    """Run SAM on an image and return masks sorted by area (largest first)."""
    generator = load_sam()
    masks = generator.generate(image)
    masks.sort(key=lambda m: m["area"], reverse=True)
    return masks


def caption_crop(image: Image.Image) -> str:
    """Generate a short caption for an image crop."""
    processor, model = load_blip()
    inputs = processor(image, return_tensors="pt").to(DEVICE)
    with torch.no_grad():
        out = model.generate(**inputs, max_new_tokens=30)
    return processor.decode(out[0], skip_special_tokens=True)
