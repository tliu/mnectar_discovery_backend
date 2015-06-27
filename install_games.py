import os
ids = 59
ips = 106
ipe = 113


i = 0
for ip in range(ips, ipe+1):
    os.popen("adb disconnect")
    print os.popen("adb connect 192.168.1.%d"  % ip).read()
    s = ids+(4*i)
    for game in range(s, s+4):
        print "install id: %d on 192.168.1.%d" % (game, ip)
        os.popen("adb install ./assets/%d/*.apk" % game)

    i+=1

