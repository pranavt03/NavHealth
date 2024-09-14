import cv2
import pytesseract

def ocr_image(image_path):
    # Load the image using OpenCV
    image = cv2.imread(image_path)
    
    # Convert the image to grayscale
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    
    # Apply thresholding to create a binary image
    _, binary = cv2.threshold(gray, 128, 255, cv2.THRESH_BINARY_INV)
    
    # Use pytesseract to perform OCR on the binary image
    text = pytesseract.image_to_string(binary)
    
    return text


# Example usage
print(ocr_image("IMG_6076.jpg"))