"""舊自製引擎驗證入口改由StPageFlip測試取代。"""
from pathlib import Path
import runpy
runpy.run_path(str(Path(__file__).with_name("pageflip-diary.browser.py")),run_name="__main__")
