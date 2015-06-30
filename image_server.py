
import os
from flask import Flask
app = Flask(__name__)
from flask import send_file

@app.route("/assets/<id>/<filename>")
def home(id, filename):
    STATIC_PATH = "%s/assets" % os.path.dirname(os.path.realpath(__file__))
    return send_file("%s/%s/%s" % (STATIC_PATH, id, filename))


if __name__ == "__main__":
    app.run(debug=True, host='0.0.0.0', port=8005)
