"""Android logo in polished metal, the mirror image of the Apple scene, turning the
other way. Run: Blender -b -P android-logo/build.py"""
import os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
import bpy  # noqa: E402
import common  # noqa: E402

INSET = float(os.environ.get("INSET", 0.03))  # keeps the gaps between head, body and arms
BEVEL_RES = int(os.environ.get("BEVEL_RES", 19))  # rounder edge than the Apple

sc = common.reset()
loops = common.svg_outlines(os.path.join(HERE, "android_logo.svg"), 2.0)

# One mesh for every outline, so the eyes stay holes in the head.
me = common.extrude_loops("Android", [common.clean_loop(l) for l in loops], bevel_res=BEVEL_RES, inset=INSET)
me.materials.append(common.metal())
android = bpy.data.objects.new("Android", me)
sc.collection.objects.link(android)
common.place([android], 1.9988, (0.0988, 0.0732, 2.0616), width=1.6926)
common.finish_mesh(android, 50)

common.stage(sc, "AndroidLogo", [android], mirror=True, spin=-1)
out = os.path.join(HERE, "android_logo_metal.blend")
bpy.ops.wm.save_as_mainfile(filepath=out)
print("SAVED", out, len(me.vertices), tuple(round(d, 3) for d in android.dimensions))
