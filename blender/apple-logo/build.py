"""Apple logo in polished metal, turning on itself. Run: Blender -b -P apple-logo/build.py"""
import os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
import bpy  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402
import common  # noqa: E402

sc = common.reset()
loops = common.svg_outlines(os.path.join(HERE, "apple_logo.svg"), 2.0)

# Two parts: the body (largest outline) and the leaf.
def area(loop):
    return abs(sum(a.x * b.y - b.x * a.y for a, b in zip(loop, loop[1:] + loop[:1]))) / 2

loops.sort(key=area, reverse=True)
mat = common.metal()
parts = []
for name, loop in (("Apple_Body", loops[0]), ("Apple_Leaf", loops[1])):
    me = common.extrude_loops(name, [common.clean_loop(loop)])
    me.materials.append(mat)
    ob = bpy.data.objects.new(name, me)
    sc.collection.objects.link(ob)
    parts.append(ob)

# Same size and spot as in the video: 2.058 m tall overall, body centred on BODY_CENTER.
BODY_CENTER = Vector((0.0686, 0.0525, 1.7886))
body, leaf = parts
common.place(parts, 2.058, (0.0, 0.0, 0.0))
bpy.context.view_layer.update()
mid = sum((body.matrix_world @ Vector(c) for c in body.bound_box), Vector()) / 8
for o in parts:
    o.data.transform(Matrix.Translation(BODY_CENTER - mid))
    common.finish_mesh(o, 35)

common.stage(sc, "AppleLogo", parts, mirror=False, spin=1)
out = os.path.join(HERE, "apple_logo_metal.blend")
bpy.ops.wm.save_as_mainfile(filepath=out)
print("SAVED", out, [len(o.data.vertices) for o in parts], [tuple(round(d, 3) for d in o.dimensions) for o in parts])
