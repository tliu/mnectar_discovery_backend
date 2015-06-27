
import os
f = open('packages')
for line in f:
    print "getting: %s" % line
    os.popen("http get 0.0.0.0:8080/game/add/%s" % line.strip())
