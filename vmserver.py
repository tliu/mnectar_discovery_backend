from flask import Flask
import base64
import json
from flask import render_template
import requests
import os
import hashlib
import time
print os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static')
app = Flask(__name__, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static'))

ip_start = 100
ip_end = 113
per_device = 4
ip_prefix = "http://192.168.1."
just_ip = "192.168.1."
ip_port = "6001"
id_start = 35
id_end = 84

available_devices = []
devices_in_use = []

def generate_device_list():
    devices =[]
    for ip in range(ip_start, ip_end + 1):
        devices.append("%s%d:%s" % (ip_prefix, ip, ip_port))
    return devices

image_path_prefix = "/assets/"

@app.route("/test")
def test():
    return json.dumps(available_devices)

    return json.dumps(map(lambda x:image_path_prefix + "%s/%s" % (id, x), listdir(".%s/%s" % (image_path_prefix, id))))

@app.route("/app/<id>/launch")
def install_and_launch(id):
    ip = ((int(id) - id_start) / 4) + ip_start
    path = './assets/%s/' % id
    files = os.listdir(path)
    package = ""
    activity = ""
    orien = "p"
    for f in files:
        if ".apk" in f:
            apk = open(path + f)
            pna = get_package_and_activity(path + f)
            package = pna[0]
            activity = pna[1]
        if "orien" in f:
            orien = f.strip().split("-")[1]


    req = '%s%d:%s/admin/app/launch?package=%s&activity=%s' % (ip_prefix, ip, ip_port, package, activity)
    r = requests.get(req)


    curr = ""
    while curr != package:
        curr = requests.get("%s%d:6001/admin/app/package" % (ip_prefix, ip)).text
        print curr

    #req = '%s%d:%s/admin/device/exec' % (ip_prefix, ip, ip_port)
    #r = requests.post(req, data="content insert --uri content://settings/system --bind name:s:accelerometer_rotation --bind value:i:0")
    #r = requests.post(req, data="content insert --uri content://settings/system --bind name:s:user_rotation --bind value:i:3")
    #time.sleep(5)

    img = ""
    with open("./assets/%s/logo.png" % id, "rb") as img_file:
        img = base64.b64encode(img_file.read())

    name = requests.get("http://192.168.1.222:8002/game/%s/name" % id).text

    return render_template("vmtest.html", ip = "%s%s" % (just_ip, ip), orien = orien, name=name, img=img, package=package)
#md5sum:
#package:
#activity:

@app.route("/app/<ip>/orientation")
def getOrientation(ip):
    os.popen("adb disconnect")
    os.popen("adb connect %s" % ip)
    o = os.popen("adb shell \"dumpsys input | grep SurfaceOrientation | awk '{print $2}' | head -n 1\"").read()
    return o.split(":")[1].strip()

@app.route("/app/<ip>/current")
def getCurrentApp(ip):
    r = requests.get("http://%s:6001/admin/app/package" % ip)
    return r.text


@app.route("/odroid/<ip>/release")
def release_odroid(ip):
    if ip in devices_in_use:
        devices_in_use.remove(ip)
        available_devices.append(ip)

def get_package_and_activity(path):
    badging = os.popen("/home/thomas/dev/android-odroid/out/host/linux-x86/bin/aapt dump badging %s" % path).read()
    badging_dict = {}
    package = ""
    activity = ""
    for line in badging.split("\n"):
        split = line.split(":")
        if len(split) >= 2:
            key = split[0]
            badging_dict[key] = split[1]
            if "package" in line:
                package = badging_dict["package"].split("'")[1]
            elif "launchable" in line:
                activity = badging_dict["launchable-activity"].split("'")[1]

    return (package, activity)


if __name__ == "__main__":
    available_devices = generate_device_list()
    app.run(debug=True, host='0.0.0.0', port=8001)
