from flask import Flask, request, jsonify
import pandas as pd

app = Flask(__name__)

# Load Excel or CSV file once
df = pd.read_csv("classified_papers.csv")  # or your Excel with pd.read_excel()

@app.route("/api/papers", methods=["GET"])
def get_papers():
    domain = request.args.get("domain")
    if not domain:
        return jsonify([])

    filtered = df[df["Main Domain"].str.lower() == domain.lower()]
    papers = filtered.to_dict(orient="records")
    return jsonify(papers)

if __name__ == "__main__":
    app.run(debug=True)
