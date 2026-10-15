import contextlib
import json
import sys
from pathlib import Path

def run(args):
    base = Path(__file__).resolve().parent
    source = Path(args['path'])
    if not source.is_absolute():
        source = base / source
    if not source.is_file():
        raise ValueError('File not found.')
    if source.stat().st_size > 100 * 1024 * 1024:
        raise ValueError('Input limit: 100 MB. Split the document.')
    start, limit = args.get('start', 0), args.get('limit', 1)
    if not isinstance(start, int) or start < 0 or not isinstance(limit, int) or not 1 <= limit <= 3:
        raise ValueError('start must be >= 0; limit must be between 1 and 3.')
    from PIL import Image
    import pypdfium2 as pdfium
    from rapidocr import RapidOCR, OCRVersion, ModelType, LangRec
    Image.MAX_IMAGE_PIXELS = 20_000_000
    with contextlib.redirect_stdout(sys.stderr):
        engine = RapidOCR(params={
            'Global.model_root_dir': str(base / 'runtime/ocr/models'),
            'Global.log_level': 'warning',
            'Det.ocr_version': OCRVersion.PPOCRV4, 'Det.model_type': ModelType.MOBILE,
            'Rec.ocr_version': OCRVersion.PPOCRV5, 'Rec.model_type': ModelType.MOBILE, 'Rec.lang_type': LangRec.LATIN,
            'EngineConfig.onnxruntime.intra_op_num_threads': 2,
            'EngineConfig.onnxruntime.inter_op_num_threads': 1,
            'EngineConfig.onnxruntime.use_cuda': False,
            'EngineConfig.onnxruntime.use_dml': False,
        })
        document = pdfium.PdfDocument(str(source)) if source.suffix.lower() == '.pdf' else None
        image = None if document else Image.open(source)
        total = len(document) if document else getattr(image, 'n_frames', 1)
        if start >= total:
            raise ValueError('start is beyond the available pages.')
        pages = []
        try:
            for index in range(start, min(total, start + limit)):
                if document:
                    page = document[index]
                    width, height = page.get_size()
                    scale = min(2, (20_000_000 / max(1, width * height)) ** .5)
                    bitmap = page.render(scale=scale)
                    frame = bitmap.to_pil().convert('RGB')
                else:
                    image.seek(index)
                    frame = image.convert('RGB')
                result = engine(frame)
                texts = list(result.txts or [])
                scores = [round(float(v), 3) for v in (result.scores or [])]
                text = '\n'.join(texts)
                pages.append({'page': index + 1, 'text': text[:25000], 'truncated': len(text) > 25000,
                              'mean_confidence': round(sum(scores) / len(scores), 3) if scores else None})
                frame.close()
                if document:
                    bitmap.close()
                    page.close()
        finally:
            if document:
                document.close()
            elif image:
                image.close()
    end = start + len(pages)
    return {'source': str(source), 'total': total, 'pages': pages, 'next': end if end < total else None,
            'notice': 'OCR can be inaccurate. Verify names, numbers and low-confidence passages against the original image.'}

if __name__ == '__main__':
    try:
        print(json.dumps(run(json.load(sys.stdin)), ensure_ascii=False))
    except Exception as error:
        print(json.dumps({'error': str(error)}, ensure_ascii=False))
        sys.exit(1)
