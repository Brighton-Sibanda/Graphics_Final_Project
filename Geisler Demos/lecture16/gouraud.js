// Last edited by Dietrich Geisler 2025

// references to the GLSL programs we need to load
var g_vshader
var g_fshader

// references to general information
var g_canvas
var gl
var g_lastFrameMS

// GLSL uniform references
var g_u_model_ref
var g_u_world_ref
var g_u_camera_ref
var g_u_projection_ref
var g_u_inversetranspose_ref
var g_u_light_ref
var g_u_specpower_ref
var g_u_flatlighting_ref

// usual model/world matrices
var g_modelMatrix
var g_worldMatrix
var g_projectionMatrix

// keep track of the camera position, always looking at the teapot
var g_cameraDistance
var g_cameraAngle
var g_cameraHeight

// the current axis of rotation
var g_rotationAxis

// Mesh definitions
var g_teapotMesh
var g_gridMesh

// Normal definitions
var g_teapotNormals

// Light position
var g_lightPosition

// Spec Power
var g_specPower

// Key states
var g_movingUp
var g_movingDown
var g_movingLeft
var g_movingRight
var g_movingForward
var g_movingBackward

// We're using triangles, so our primitives each have 3 elements
const TRIANGLE_SIZE = 3

// The size in bytes of a floating point
const FLOAT_SIZE = 4

function main() {
    // Setup our sliders
    slider_input = document.getElementById('sliderX')
    slider_input.addEventListener('input', (event) => {
        updateLightX(event.target.value)
    })
    slider_input = document.getElementById('sliderY')
    slider_input.addEventListener('input', (event) => {
        updateLightY(event.target.value)
    })
    slider_input = document.getElementById('sliderZ')
    slider_input.addEventListener('input', (event) => {
        updateLightZ(event.target.value)
    })
    slider_input = document.getElementById('sliderPower')
    slider_input.addEventListener('input', (event) => {
        updateSpecPower(event.target.value)
    })

    // Setup key presses and releases
    setupKeyBinds()

    g_canvas = document.getElementById('canvas')

    // Get the rendering context for WebGL
    gl = getWebGLContext(g_canvas, true)
    if (!gl) {
        console.log('Failed to get the rendering context for WebGL')
        return
    }

    // We will call this at the end of most main functions from now on
    loadOBJFiles()
}

/*
 * Helper function to load OBJ files in sequence
 * For much larger files, you may are welcome to make this more parallel
 * I made everything sequential for this class to make the logic easier to follow
 */
async function loadOBJFiles() {
    // open our OBJ file(s)
    data = await fetch('/resources/teapot.obj').then(response => response.text()).then((x) => x)
    g_teapotMesh = []
    g_teapotNormals = []
    // read the obj mesh _and_ normals
    readObjFile(data, g_teapotMesh, g_teapotNormals)

    // load our GLSL files before rendering
    loadGLSLFiles()
}
    
async function loadGLSLFiles() {
    g_vshader = await fetch('/gouraud.vert').then(response => response.text()).then((x) => x)
    g_fshader = await fetch('/gouraud.frag').then(response => response.text()).then((x) => x)

    // wait until everything is loaded before rendering
    startRendering()
}

function startRendering() {
    // Initialize GPU's vertex and fragment shaders programs
    if (!initShaders(gl, g_vshader, g_fshader)) {
        console.log('Failed to intialize shaders.')
        return
    }

    // build a grid mesh
    g_gridMesh = buildGridMesh(1, 1)

    // initialize the VBO with grid information
    // note that we duplicate the grid mesh to "fill in" normals
    var data = g_teapotMesh.concat(g_gridMesh).concat(g_teapotNormals).concat(g_gridMesh)
    if (!initVBO(new Float32Array(data))) {
        return
    }

    // Send our vertex data to the GPU
    if (!setupVec3(
        'a_Position', 0, 0)) {
        return
    }
    if (!setupVec3('a_Normal', 0, FLOAT_SIZE * (g_teapotMesh.length + g_gridMesh.length))) {
        return
    }

    // Get references to GLSL uniforms
    g_u_model_ref = gl.getUniformLocation(gl.program, 'u_Model')
    g_u_world_ref = gl.getUniformLocation(gl.program, 'u_World')
    g_u_camera_ref = gl.getUniformLocation(gl.program, 'u_Camera')
    g_u_projection_ref = gl.getUniformLocation(gl.program, 'u_Projection')
    g_u_inversetranspose_ref = gl.getUniformLocation(gl.program, 'u_ModelWorldInverseTranspose')
    g_u_light_ref = gl.getUniformLocation(gl.program, 'u_Light')
    g_u_specpower_ref = gl.getUniformLocation(gl.program, 'u_SpecPower')
    g_u_flatlighting_ref = gl.getUniformLocation(gl.program, 'u_FlatLighting')

    // Setup and scale our model (down quite a bit)
    g_modelMatrix = new Matrix4().scale(.01, .01, -.01)

    // Place our teapot in the world
    g_worldMatrix = new Matrix4()

    // Initially place the camera in "front" and above the teapot a bit
    g_cameraDistance = 1.5
    g_cameraAngle = 90
    g_cameraHeight = .2

    // Setup a "reasonable" perspective matrix
    g_projectionMatrix = new Matrix4().setPerspective(90, 1, .1, 500)

    // Enable culling and depth
    gl.enable(gl.CULL_FACE)
    gl.enable(gl.DEPTH_TEST)

    // Setup for ticks
    g_lastFrameMS = Date.now()

    // initial value declarations
    g_lightPosition = [0, 0, 0]
    updateLightX(0)
    updateLightY(0)
    updateLightZ(2)
    updateSpecPower(16)

    tick()
}

// extra constants for cleanliness
const ROTATION_SPEED = .02
const CAMERA_SPEED = .003
const CAMERA_ROT_SPEED = .1

// function to apply all the logic for a single frame tick
function tick() {
    // time since the last frame
    var deltaTime

    // calculate deltaTime
    var current_time = Date.now()
    deltaTime = current_time - g_lastFrameMS
    g_lastFrameMS = current_time

    // rotate the teapot constantly around the given axis (of the model)
    angle = ROTATION_SPEED * deltaTime
    g_worldMatrix = new Matrix4().setRotate(angle, 0, 1, 0).concat(g_worldMatrix)

    // move the camera based on user input
    if (g_movingUp) {
        g_cameraHeight += CAMERA_SPEED * deltaTime
    }
    if (g_movingDown) {
        g_cameraHeight -= CAMERA_SPEED * deltaTime
    }
    if (g_movingLeft) {
        g_cameraAngle += CAMERA_ROT_SPEED * deltaTime
    }
    if (g_movingRight) {
        g_cameraAngle -= CAMERA_ROT_SPEED * deltaTime
    }
    if (g_movingForward) {
        // note that moving "forward" means "towards the teapot"
        g_cameraDistance -= CAMERA_SPEED * deltaTime
        // we don't want to hit a distance of 0
        g_cameraDistance = Math.max(g_cameraDistance, 1.0)
    }
    if (g_movingBackward) {
        g_cameraDistance += CAMERA_SPEED * deltaTime
    }

    draw()

    requestAnimationFrame(tick, g_canvas)
}

// draw to the screen on the next frame
function draw() {
    // Calculate the camera position from our angle and height
    // we get to use a bit of clever 2D rotation math
    // note that we can only do this because we're "fixing" our plane of motion
    // if we wanted to allow arbitrary rotation, we would want quaternions!
    camX = Math.cos(Math.PI * g_cameraAngle / 180)
    camY = g_cameraHeight
    camZ = Math.sin(Math.PI * g_cameraAngle / 180)
    var cameraPosition = new Vector3([camX, camY, camZ])
    cameraPosition.normalize()
    
    // calculate distance and turn into an array for matrix entry
    var cameraPositionArray = [
        cameraPosition.elements[0] * g_cameraDistance,
        cameraPosition.elements[1] * g_cameraDistance,
        cameraPosition.elements[2] * g_cameraDistance
    ]

    // Build a new lookat matrix each frame
    cameraMatrix = new Matrix4().setLookAt(...cameraPositionArray, 0, 0, 0, 0, 1, 0)

    // Calculate the inverse transpose of our model matrix each frame
    var inverseTranspose = new Matrix4(g_worldMatrix).multiply(g_modelMatrix)
    inverseTranspose.invert().transpose()

    // Clear the canvas with a black background
    gl.clearColor(0.0, 0.0, 0.0, 1.0)
    gl.clear(gl.COLOR_BUFFER_BIT)

    // Update with our global transformation matrices
    gl.uniformMatrix4fv(g_u_model_ref, false, g_modelMatrix.elements)
    gl.uniformMatrix4fv(g_u_world_ref, false, g_worldMatrix.elements)
    gl.uniformMatrix4fv(g_u_camera_ref, false, cameraMatrix.elements)
    gl.uniformMatrix4fv(g_u_projection_ref, false, g_projectionMatrix.elements)
    gl.uniformMatrix4fv(g_u_inversetranspose_ref, false, inverseTranspose.elements)

    // don't use flat lighting for our teapot
    gl.uniform1i(g_u_flatlighting_ref, false)

    // Update with our light position to be behind the camera
    gl.uniform3fv(g_u_light_ref, new Float32Array(g_lightPosition))

    // Update our spec power
    gl.uniform1f(g_u_specpower_ref, g_specPower)

    // Draw our teapot
    gl.drawArrays(gl.TRIANGLES, 0, g_teapotMesh.length / 3)

    // the grid has a constant identity matrix for model and world
    // world includes our Y offset
    gl.uniformMatrix4fv(g_u_model_ref, false, new Matrix4().elements)
    gl.uniformMatrix4fv(g_u_world_ref, false, new Matrix4().translate(0, GRID_Y_OFFSET, 0).elements)

    // use flat lighting for our grid
    gl.uniform1i(g_u_flatlighting_ref, true)

    // draw the grid
    gl.drawArrays(gl.LINES, g_teapotMesh.length / 3, g_gridMesh.length / 3)
}

function updateLightX(amount) {
    label = document.getElementById('lightX')
    label.textContent = `Light X: ${Number(amount).toFixed(2)}`
    g_lightPosition[0] = Number(amount)
}

function updateLightY(amount) {
    label = document.getElementById('lightY')
    label.textContent = `Light Y: ${Number(amount).toFixed(2)}`
    g_lightPosition[1] = Number(amount)
}

function updateLightZ(amount) {
    label = document.getElementById('lightZ')
    label.textContent = `Light Z: ${Number(amount).toFixed(2)}`
    g_lightPosition[2] = Number(amount)
}

function updateSpecPower(amount) {
    label = document.getElementById('specPower')
    label.textContent = `Specular Power: ${Number(amount).toFixed(0)}`
    g_specPower = Number(amount)
}

/*
 * Helper function to setup key binding logic
 */
function setupKeyBinds() {
    // Start movement when the key starts being pressed
    document.addEventListener('keydown', function(event) {
        if (event.key == 'r') {
			g_movingUp = true
		}
        else if (event.key == 'f') {
			g_movingDown = true
		}
        else if (event.key == 'a') {
			g_movingLeft = true
		}
        else if (event.key == 'd') {
			g_movingRight = true
		}
		else if (event.key == 'w') {
			g_movingForward = true
		}
		else if (event.key == 's') {
			g_movingBackward = true
		}
	})

    // End movement on key release
    document.addEventListener('keyup', function(event) {
        if (event.key == 'r') {
			g_movingUp = false
		}
        else if (event.key == 'f') {
			g_movingDown = false
		}
        else if (event.key == 'a') {
			g_movingLeft = false
		}
        else if (event.key == 'd') {
			g_movingRight = false
		}
		else if (event.key == 'w') {
			g_movingForward = false
		}
		else if (event.key == 's') {
			g_movingBackward = false
		}
	})
}

// How far in the X and Z directions the grid should extend
// Recall that the camera "rests" on the X/Z plane, since Z is "out" from the camera
const GRID_X_RANGE = 100
const GRID_Z_RANGE = 100

// The default y-offset of the grid for rendering
const GRID_Y_OFFSET = -2

/*
 * Helper to build a grid mesh (without colors)
 * Returns these results as an array
 */
function buildGridMesh(grid_row_spacing, grid_column_spacing) {
    var mesh = []

    // Construct the rows
    for (var x = -GRID_X_RANGE; x < GRID_X_RANGE; x += grid_row_spacing) {
        // two vertices for each line
        // one at -Z and one at +Z
        mesh.push(x, 0, -GRID_Z_RANGE)
        mesh.push(x, 0, GRID_Z_RANGE)
    }

    // Construct the columns extending "outward" from the camera
    for (var z = -GRID_Z_RANGE; z < GRID_Z_RANGE; z += grid_column_spacing) {
        // two vertices for each line
        // one at -Z and one at +Z
        mesh.push(-GRID_X_RANGE, 0, z)
        mesh.push(GRID_X_RANGE, 0, z)
    }

    return mesh
}

/*
 * Initialize the VBO with the provided data
 * Assumes we are going to have "static" (unchanging) data
 */
function initVBO(data) {
    // get the VBO handle
    var VBOloc = gl.createBuffer()
    if (!VBOloc) {
        console.log('Failed to create the vertex buffer object')
        return false
    }

    // Bind the VBO to the GPU array and copy `data` into that VBO
    gl.bindBuffer(gl.ARRAY_BUFFER, VBOloc)
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)

    return true
}

/*
 * Helper function to load the given vec3 data chunk onto the VBO
 * Requires that the VBO already be setup and assigned to the GPU
 */
function setupVec3(name, stride, offset) {
    // Get the attribute by name
    var attributeID = gl.getAttribLocation(gl.program, `${name}`)
    if (attributeID < 0) {
        console.log(`Failed to get the storage location of ${name}`)
        return false
    }

    // Set how the GPU fills the a_Position variable with data from the GPU 
    gl.vertexAttribPointer(attributeID, 3, gl.FLOAT, false, stride, offset)
    gl.enableVertexAttribArray(attributeID)

    return true
}