# jmaker-server

## requirements:

- FreeBSD >= 11.1
- zfs
- redis
- rsync
- node >= 9.1
- yarn

file system preparation:
```sh
zfs create -p -o mountpoint=/usr/local/jmaker/containers zroot/jmaker/containers
zfs create -p -o mountpoint=/usr/local/jmaker/volumes zroot/jmaker/volumes
zfs create -p -o mountpoint=/usr/local/jmaker/packages zroot/jmaker/packages
```

tune shell profile file:
```sh
export JMAKER_CONTAINERS_LOCATION=zroot/jmaker/containers #required
export JMAKER_VOLUMES_LOCATION=zroot/jmaker/volumes       #optional
export JMAKER_PACKAGES_LOCATION=zroot/jmaker/packages     #optional
export JMAKER_SPECIAL_SNAP_NAME=forks                     #optional
export JMAKER_MAINTAINER=name@domain.com                  #optional
```

tune in /boot/loader.conf:
```
kern.racct.enable=1
```

tune in /etc/rc.conf:
```
redis_enable="YES"

# recommendations:
sendmail_enable="NO"
rpcbind_enable="NO"
```

## install:
1. clone and change directory project
2. install dependencies `$ yarn`

