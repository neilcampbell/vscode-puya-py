from algopy import ARC4Contract, String
from algopy.arc4 import abimethod

from smart_contracts.hello_world.hello import say_hello


class HelloWorld(ARC4Contract):
    @abimethod()
    def hello(self, name: String) -> String:
        return say_hello(name)
