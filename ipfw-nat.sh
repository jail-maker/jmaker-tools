#!/bin/sh

ipfw nat 45 config if lo1
ipfw add 10 allow ip from any to any via lo1
ipfw add 20 nat 45 ip from any to any via xl0
