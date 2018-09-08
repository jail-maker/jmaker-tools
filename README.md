# jmaker-server

## requirements:

- FreeBSD >= 11.1
- zfs
- redis
- rsync
- node >= 9.1
- yarn

## configuration:

for NAT (see ipfw_rules.sh):
```sh
sudo sysrc cloned_interfaces+=lo1
sudo sysrc ifconfig_lo1="inet 127.0.0.1"
sudo sysrc ifconfig_lo1_alias0="inet 127.0.0.2"
sudo sysrc firewall_enable=YES
sudo sysrc firewall_nat_enable=YES
sudo sysrc firewall_script=/usr/local/etc/ipfw_rules.sh
```

file system preparation:
```sh
sudo zfs create -p -o mountpoint=/usr/local/jmaker/containers zroot/jmaker/containers
sudo zfs create -p -o mountpoint=/usr/local/jmaker/volumes zroot/jmaker/volumes
sudo zfs create -p -o mountpoint=/usr/local/jmaker/packages zroot/jmaker/packages
```

put in shell profile file:
```sh
export JMAKER_CONTAINERS_LOCATION=zroot/jmaker/containers       #required
export JMAKER_VOLUMES_LOCATION=zroot/jmaker/volumes             #optional
export JMAKER_PACKAGES_LOCATION=zroot/jmaker/packages           #optional
export JMAKER_SPECIAL_SNAP_NAME=forks                           #optional
export JMAKER_MAINTAINER=name@domain.com                        #optional
export JMAKER_LOCAL_NETWORK_AGENT_ADDR=http://127.0.0.1:3367    #optional
export JMAKER_DNS_RESOLVER_TYPE=auto                            #optional
export JMAKER_DNS_RESOLVER_ADDR=127.0.0.2                       #optional
```

put in sudoers:
```
Defaults env_keep += "JMAKER_*"
```

put in /boot/loader.conf:
```
kern.racct.enable=1
```

put in /etc/rc.conf:
```
redis_enable="YES"

# recommendations:
sendmail_enable="NO"
rpcbind_enable="NO"
```

## building:
1. clone and change directory project
2. install dependencies `$ yarn`
