// Tesseract OCR backup: prints text found in an image.
import Tesseract from "tesseract.js";
const { data } = await Tesseract.recognize(process.argv[2], "eng");
console.log(data.text);
