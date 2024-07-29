import nbformat as nbf

# Load the notebook
notebook_path = 'phishing-site-prediction.ipynb'
with open(notebook_path, 'r', encoding='utf-8') as f:
    notebook = nbf.read(f, as_version=4)

# Create a new code cell for saving the vectorizer
save_vectorizer_code = """
import joblib

# Save the vectorizer
vectorizer_path = 'vectorizer.pkl'
joblib.dump(vectorizer, vectorizer_path)
print(f"Vectorizer saved to {vectorizer_path}")
"""

# Insert the new cell after the cell defining the vectorizer
vectorizer_defined = False
for i, cell in enumerate(notebook.cells):
    if 'vectorizer' in cell.source.lower():
        vectorizer_defined = True
    if vectorizer_defined and cell.cell_type == 'code':
        vectorizer_defined = False
        notebook.cells.insert(i + 1, nbf.v4.new_code_cell(save_vectorizer_code))
        break

# Save the updated notebook
updated_notebook_path = 'phishing-site-prediction.ipynb'
with open(updated_notebook_path, 'w', encoding='utf-8') as f:
    nbf.write(notebook, f)

updated_notebook_path
