# Step 1: Import required libraries
import pandas as pd
import numpy as np

# Step 2: Load the CSV file (Update the path if your file is named differently)
file_path = r"C:\Users\Raj Dhanush\OneDrive\Desktop\DBMS Project\Dbms\scopus.csv"  # or r'full\path\to\your\file.csv'
df = pd.read_csv(file_path)

# Step 3: Handle missing keywords
df['Author Keywords'] = df['Author Keywords'].fillna("")

# Step 4: Preprocess keywords - lowercased & clean up separators
df['keywords_cleaned'] = df['Author Keywords'].str.lower().str.replace(r"[;,]", ",", regex=True)

# Step 5: Define function to classify into major domains
def classify_domain(keywords):
    keyword_list = [kw.strip() for kw in keywords.split(",")]
    for kw in keyword_list:
        if "deep learning" in kw or "neural" in kw or "cnn" in kw:
            return "AI"
        elif "machine learning" in kw or "ml" in kw or "classification" in kw:
            return "Machine Learning"
        elif "cybersecurity" in kw or "encryption" in kw or "malware" in kw or "network security" in kw:
            return "Cybersecurity"
        elif "iot" in kw or "internet of things" in kw:
            return "IoT"
        elif "data science" in kw or "data analysis" in kw or "big data" in kw:
            return "Data Science"
        elif "cloud" in kw or "virtualization" in kw:
            return "Cloud Computing"
        elif "blockchain" in kw:
            return "Blockchain"
        elif "nlp" in kw or "natural language" in kw:
            return "NLP"
        elif "robot" in kw or "robotics" in kw:
            return "Robotics"
        elif "image processing" in kw or "computer vision" in kw:
            return "Image Processing"
        elif "network" in kw or "wireless" in kw:
            return "Networks"
    return "Others"

# Step 6: Apply the classifier to each row
df['Main Domain'] = df['keywords_cleaned'].apply(classify_domain)

# Step 7: View domain-wise paper count
domain_counts = df['Main Domain'].value_counts()
print("Domain-wise Distribution:")
print(domain_counts)

# Step 8: Optional - Save to new CSV for frontend integration or manual review
df.to_csv('classified_papers.csv', index=False)



