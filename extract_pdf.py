import PyPDF2
import sys

pdf_path = '../NGIPS_Architecture_Plan.pdf'

try:
    with open(pdf_path, 'rb') as pdf_file:
        reader = PyPDF2.PdfReader(pdf_file)
        
        print(f"Total pages: {len(reader.pages)}\n")
        print("="*80)
        print("PDF CONTENT")
        print("="*80)
        print()
        
        for i, page in enumerate(reader.pages, 1):
            print(f"\n--- Page {i} ---\n")
            text = page.extract_text()
            print(text)
            print()
            
except FileNotFoundError:
    print(f"Error: Could not find {pdf_path}")
    sys.exit(1)
except Exception as e:
    print(f"Error: {e}")
    sys.exit(1)
