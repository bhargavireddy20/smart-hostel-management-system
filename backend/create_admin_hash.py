
from getpass import getpass
from pwdlib import PasswordHash

password = getpass("Create your SmartStay admin password: ")
confirm = getpass("Confirm your admin password: ")

if len(password) < 12:
    raise SystemExit("Use at least 12 characters.")

if password != confirm:
    raise SystemExit("Passwords do not match.")

password_hash = PasswordHash.recommended().hash(password)

print("\nCopy this hash into ADMIN_PASSWORD_HASH in your .env:")
print(password_hash)
