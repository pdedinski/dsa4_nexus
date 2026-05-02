import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

import pdfplumber

def extract_pages(pdf_path, start_page, end_page):
    """Extract text from pages (1-indexed)"""
    with pdfplumber.open(pdf_path) as pdf:
        total = len(pdf.pages)
        print(f"Total pages: {total}")
        for page_num in range(start_page, end_page + 1):
            if page_num > total:
                break
            page = pdf.pages[page_num - 1]
            text = page.extract_text()
            print(f"\n=== PAGE {page_num} ===")
            if text:
                print(text)
            else:
                print("[No text extracted]")

if __name__ == "__main__":
    pdf_path = sys.argv[1]
    start = int(sys.argv[2])
    end = int(sys.argv[3])
    extract_pages(pdf_path, start, end)
