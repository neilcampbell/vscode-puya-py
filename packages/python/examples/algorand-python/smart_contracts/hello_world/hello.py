from algopy import String, subroutine


@subroutine()
def say_hello(name: String) -> String:
    return "Hello, " + name
