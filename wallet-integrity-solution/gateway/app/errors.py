"""Domain errors, each mapping to an HTTP status. Raising one blocks the op."""
from __future__ import annotations


class DomainError(Exception):
    status = 400
    code = "bad_request"

    def __init__(self, reason: str):
        super().__init__(reason)
        self.reason = reason


class AuthError(DomainError):          # bad signature, replay, bad session
    status = 401
    code = "auth_failed"


class FundingError(DomainError):       # no verified funding, bad voucher, bad webhook sig
    status = 422
    code = "funding_rejected"


class LedgerError(DomainError):        # unbalanced txn, insufficient funds
    status = 422
    code = "ledger_rejected"


class ValidationError(DomainError):    # malformed input
    status = 400
    code = "invalid_request"
