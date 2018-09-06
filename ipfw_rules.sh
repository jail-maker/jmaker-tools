#!/bin/sh

# simple example firewall rules
# copy this script to new location e.g. to /usr/local/etc/ipfw_rules.sh
# and put setting in your rc.conf: 
# $ sysrc firewall_rules=open
# $ sysrc firewall_script=/usr/local/etc/ipfw_rules.sh

ext_if=re0 # replace it with your external interface
int_if=lo1 # replace it with your internal interface

ipfw nat 45 config if ${ext_if}
ipfw add 20 allow ip from any to any via ${int_if}
ipfw add 10 nat 45 ip from any to any via ${ext_if}
