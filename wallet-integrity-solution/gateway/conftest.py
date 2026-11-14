import os
import sys
import tempfile

# Make `app` and `client` importable, and pin a throwaway DB before app imports.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault("WALLET_DB", os.path.join(tempfile.mkdtemp(), "test_wallet.db"))
