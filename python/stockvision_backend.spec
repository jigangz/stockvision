# -*- mode: python ; coding: utf-8 -*-
# PyInstaller spec for StockVision backend sidecar
# Run: pyinstaller python/stockvision_backend.spec --distpath src-tauri/binaries/

import sys
from pathlib import Path

block_cipher = None

# Collect all Python source files from the python/ package
# Use SPECPATH so it works regardless of CWD
src = Path(SPECPATH)

a = Analysis(
    [str(src / "main_sidecar.py")],
    pathex=[str(src)],
    binaries=[],
    datas=[],
    hiddenimports=[
        # FastAPI / Starlette
        "uvicorn.logging",
        "uvicorn.loops",
        "uvicorn.loops.auto",
        "uvicorn.loops.asyncio",
        "uvicorn.protocols",
        "uvicorn.protocols.http",
        "uvicorn.protocols.http.auto",
        "uvicorn.protocols.http.h11_impl",
        "uvicorn.protocols.websockets",
        "uvicorn.protocols.websockets.auto",
        "uvicorn.lifespan",
        "uvicorn.lifespan.on",
        "starlette.middleware.cors",
        "starlette.routing",
        # Data libraries
        "pandas",
        "numpy",
        "pyarrow",
        # Formula engine
        "lark",
        # Optional data sources (may not be installed)
        "akshare",
        "tushare",
        # Internal packages
        "api.data",
        "api.config",
        "api.drawings",
        "api.indicators",
        "api.stats",
        "api.formula",
        "api.screener",
        "api.heatmap",
        "api.capital_flow",
        "api.datasource",
        "api.backtest",
        "api.health_monitor",
        "data.adapter",
        "data.mock_adapter",
        "data.akshare_adapter",
        "data.tushare_adapter",
        "data.tdx_adapter",
        "data.storage",
        "data.indicators_calc",
        "data.formula_engine",
        "data.backtest_engine",
        "models.candle",
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name="python-backend",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,  # no console window for sidecar
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
