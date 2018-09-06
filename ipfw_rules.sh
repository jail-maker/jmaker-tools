#!/bin/sh

# simple example firewall rules
# copy this script to new location e.g. to /usr/local/etc/ipfw_rules.sh
# and put setting in your rc.conf: 
# $ sysrc firewall_enable=YES
# $ sysrc firewall_nat_enable=YES
# $ sysrc firewall_script=/usr/local/etc/ipfw_rules.sh

ext_if=re0 # replace it with your external interface
int_if=lo1 # replace it with your internal interface
network=127.0.0.1/8 # replace it with your private network

ipfw -q -f flush

ipfw nat 45 config if ${ext_if}
ipfw add 10 nat 45 ip from any to me via ${ext_if}
ipfw add 20 nat 45 ip from ${network} to any via ${ext_if}
ipfw add 30 allow ip from any to any via ${int_if}

ipfw add 00100 allow ip from any to any via lo0
ipfw add 00200 deny ip from any to 127.0.0.0/8
ipfw add 00300 deny ip from 127.0.0.0/8 to any
ipfw add 00400 deny ip from any to ::1
ipfw add 00500 deny ip from ::1 to any
ipfw add 00600 allow ipv6-icmp from :: to ff02::/16
ipfw add 00700 allow ipv6-icmp from fe80::/10 to fe80::/10
ipfw add 00800 allow ipv6-icmp from fe80::/10 to ff02::/16
ipfw add 00900 allow ipv6-icmp from any to any ip6 icmp6types 1
ipfw add 01000 allow ipv6-icmp from any to any ip6 icmp6types 2,135,136
ipfw add 65000 allow ip from any to any
