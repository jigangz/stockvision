"""
Test configuration — ensure tests use MockAdapter, not real AKShare.
This file is loaded by pytest before any test modules.
"""
import os

os.environ["STOCKVISION_ADAPTER"] = "mock"
