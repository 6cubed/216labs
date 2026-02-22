export interface Bbox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface MaskRLE {
  startValue: number;
  lengths: number[];
}

export interface Segment {
  id: number;
  caption: string;
  bbox: Bbox;
  area: number;
  color: [number, number, number];
  mask_rle: MaskRLE;
}

export interface FrameResult {
  frame_index: number;
  width: number;
  height: number;
  image_b64: string;
  segments: Segment[];
}

export interface ProcessResponse {
  type: "image" | "video";
  frames: FrameResult[];
}
