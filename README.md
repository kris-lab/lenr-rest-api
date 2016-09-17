[![Build Status](https://travis-ci.org/lenr-lab/lenr-rest-api.png?branch=master)](https://travis-ci.org/lenr-lab/lenr-rest-api)

(in development, [general goals](https://github.com/lenr-lab/lenr-rest-api/issues/2))

LENR
====
Data logger and analytics tool for LENR research.

Pulsar
======

Caffe
-----

```
$ pulsar -c bin/pulsar-conf-runners jetson-tx1 production -T
cap caffe:run_netowrk # Run neural network once
```

SCPI
----

```
$ pulsar -c bin/pulsar-conf-runners red-pitaya production -T
cap scpi:read_sensors # Read sensors
```
