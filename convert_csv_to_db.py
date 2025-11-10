import pandas as pd
from sqlalchemy import create_engine, VARCHAR, TEXT, INT

# Replace the placeholders with your database credentials
# The '@' in your password must be URL-encoded to '%40'
user = 'root'
password = 'Rahul%402005'  # The corrected password with '%40'
host = 'localhost'
port = 3306  # Default MySQL port
dbname = 'dbms_project'

# Create the database connection string
connection_string = f'mysql+mysqlconnector://{user}:{password}@{host}:{port}/{dbname}'

try:
    # Create a SQLAlchemy engine to connect to the database
    engine = create_engine(connection_string)

    # Read the CSV file into a pandas DataFrame
    df = pd.read_csv('classified_papers.csv')

    # Define the data types for each column
    dtype_mapping = {
        'Authors': VARCHAR(167),
        'Author full names': TEXT,
        'Author(s) ID': VARCHAR(178),
        'Title': VARCHAR(254),
        'Source title': VARCHAR(181),
        'Volume': VARCHAR(14),
        'Issue': VARCHAR(7),
        'Art. No.': VARCHAR(16),
        'Page start': VARCHAR(7),
        'Page end': VARCHAR(6),
        'Page count': INT,
        'Cited by': INT,
        'DOI': VARCHAR(45),
        'Link': VARCHAR(167),
        'Author Keywords': TEXT,
        'Document Type': VARCHAR(16),
        'Publication Stage': VARCHAR(16),
        'Open Access': VARCHAR(59),
        'Source': VARCHAR(6),
        'EID': VARCHAR(19),
        'keywords_cleaned': TEXT,
        'Main Domain': VARCHAR(22)
    }

    # Write the DataFrame to the database table
    df.to_sql(
        'classified_papers',
        con=engine,
        if_exists='replace',
        index=False,
        dtype=dtype_mapping
    )

    print("Data successfully imported into the 'classified_papers' table.")

except Exception as e:
    print(f"An error occurred: {e}")