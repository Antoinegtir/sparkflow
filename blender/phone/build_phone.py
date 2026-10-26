"""Neutral 3D phone, same look as the Apple scene (metal material, white lights, camera, spin).
Starts from a copy of apple_logo_metal.blend. Run: Blender -b phone_metal.blend -P build_phone.py"""
import bpy, bmesh, math
from mathutils import Vector, Matrix

HEIGHT = 2.0          # same overall height as the apple logo
WIDTH = 0.95          # ~19.5:9 phone proportions
CORNER = 0.16         # corner radius of the body outline
HALF_DEPTH = 0.06     # body: 0.12 m thick before rounding
EDGE = 0.03           # rounded side edges of the body
FRAME_W = 0.055       # width of the raised frame around the screen
FRAME_H = 0.012       # how far the frame stands out of the front face

sc = bpy.context.scene
sc.frame_set(1)
rig = bpy.data.objects["AppleLogo"]
rig.name = "PhoneRig"
mat = bpy.data.objects["Apple_Body"].data.materials[0]
for n in ("Apple_Body", "Apple_Leaf"):
    o = bpy.data.objects[n]; me = o.data
    bpy.data.objects.remove(o, do_unlink=True)
    if me.users == 0: bpy.data.meshes.remove(me)

def rounded_rect(w, h, r, steps=12):
    pts = []
    for cx, cy, a0 in ((1, 1, 0), (-1, 1, 90), (-1, -1, 180), (1, -1, 270)):
        c = Vector(((w / 2 - r) * cx, (h / 2 - r) * cy))
        for k in range(steps + 1):
            a = math.radians(a0 + 90 * k / steps)
            pts.append(c + Vector((math.cos(a), math.sin(a))) * r)
    return pts

def slab(loops, half, bevel, z=0.0, res=4):
    """Filled 2D shape (outer loop + optional holes), extruded and edge-rounded, front = +z."""
    cu = bpy.data.curves.new("tmp_crv", 'CURVE'); cu.dimensions = '2D'; cu.fill_mode = 'BOTH'
    for lp in loops:
        sp = cu.splines.new('POLY'); sp.points.add(len(lp) - 1)
        for p, v in zip(sp.points, lp): p.co = (v.x, v.y, 0, 1)
        sp.use_cyclic_u = True
    cu.extrude = half; cu.bevel_mode = 'ROUND'; cu.bevel_depth = bevel
    cu.bevel_resolution = res; cu.offset = -bevel          # keep the exact outline
    tmp = bpy.data.objects.new("tmp", cu); sc.collection.objects.link(tmp)
    bpy.context.view_layer.update()
    me = bpy.data.meshes.new_from_object(tmp.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    bpy.data.objects.remove(tmp, do_unlink=True); bpy.data.curves.remove(cu)
    me.transform(Matrix.Translation((0, 0, z)))
    return me

outer = rounded_rect(WIDTH, HEIGHT, CORNER)
inner = rounded_rect(WIDTH - 2 * FRAME_W, HEIGHT - 2 * FRAME_W, CORNER - FRAME_W)
front = HALF_DEPTH + EDGE
body = slab([outer], HALF_DEPTH, EDGE)
frame = slab([outer, inner[::-1]], FRAME_H / 2, FRAME_H / 2 * 0.9, z=front - EDGE * 0.5, res=3)

bm = bmesh.new()
for me in (body, frame):
    bm.from_mesh(me); bpy.data.meshes.remove(me)
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
for f in bm.faces: f.smooth = True
me = bpy.data.meshes.new("Phone"); bm.to_mesh(me); bm.free()
me.transform(Matrix.Rotation(math.radians(90), 4, 'X'))   # stand up, screen toward -Y like the apple
me.materials.append(mat)

phone = bpy.data.objects.new("Phone", me)
for c in rig.users_collection: c.objects.link(phone)
phone.parent = rig
phone.matrix_parent_inverse = Matrix.Identity(4)
bpy.ops.object.select_all(action='DESELECT'); phone.select_set(True)
bpy.context.view_layer.objects.active = phone
bpy.ops.object.shade_smooth_by_angle(angle=math.radians(40))
wn = phone.modifiers.new("WeightedNormal", 'WEIGHTED_NORMAL'); wn.keep_sharp = True

for c in bpy.data.collections:
    if c.name == "AppleLogo3D": c.name = "Phone3D"
sc.render.filepath = "//render/phone_"
sc.frame_set(1)
bpy.ops.wm.save_mainfile()
print("PHONE verts", len(me.vertices), "dims", tuple(round(d, 3) for d in phone.dimensions))
