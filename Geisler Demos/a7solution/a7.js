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

// usual model/world matrices
var g_modelMatrix1
var g_modelMatrix2
var g_modelMatrix3
var g_worldMatrix1
var g_worldMatrix2
var g_worldMatrix3
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
    data = await fetch('./resources/teapot.obj').then(response => response.text()).then((x) => x)
    g_teapotMesh = []
    g_teapotNormals = []
    // read the obj mesh _and_ normals
    readObjFile(data, g_teapotMesh, g_teapotNormals)

    // load our GLSL files before rendering
    loadGLSLFiles()
}
    
async function loadGLSLFiles() {
    g_vshader = await fetch('./phong.vert').then(response => response.text()).then((x) => x)
    g_fshader = await fetch('./phong.frag').then(response => response.text()).then((x) => x)

    // wait until everything is loaded before rendering
    startRendering()
}

function startRendering() {
    // Initialize GPU's vertex and fragment shaders programs
    if (!initShaders(gl, g_vshader, g_fshader)) {
        console.log('Failed to intialize shaders.')
        return
    }

    // initialize the VBO with grid information
    // note that we duplicate the grid mesh to "fill in" normals
    var data = g_teapotMesh.concat(g_teapotNormals)
    if (!initVBO(new Float32Array(data))) {
        return
    }

    // Send our vertex data to the GPU
    if (!setupVec3(
        'a_Position', 0, 0)) {
        return
    }
    if (!setupVec3('a_Normal', 0, FLOAT_SIZE * g_teapotMesh.length)) {
        return
    }

    // Get references to GLSL uniforms
    g_u_model_ref = gl.getUniformLocation(gl.program, 'u_Model')
    g_u_world_ref = gl.getUniformLocation(gl.program, 'u_World')
    g_u_camera_ref = gl.getUniformLocation(gl.program, 'u_Camera')
    g_u_projection_ref = gl.getUniformLocation(gl.program, 'u_Projection')
    g_u_inversetranspose_ref = gl.getUniformLocation(gl.program, 'u_ModelWorldInverseTranspose')
    g_u_light_ref = gl.getUniformLocation(gl.program, 'u_Light')
    g_u_ambient_ref = gl.getUniformLocation(gl.program, 'u_AmbientColor')
    g_u_diffuse_ref = gl.getUniformLocation(gl.program, 'u_DiffuseColor')
    g_u_specular_ref = gl.getUniformLocation(gl.program, 'u_SpecularColor')
    g_u_specpower_ref = gl.getUniformLocation(gl.program, 'u_SpecularPower')

    // Setup and scale our models (down quite a bit)
    // Also rotate them so they're slightly offset
    const TEAPOT_SCALE = 0.005
    g_modelMatrix1 = new Matrix4().scale(TEAPOT_SCALE, TEAPOT_SCALE, -TEAPOT_SCALE)
    g_modelMatrix2 = new Matrix4().scale(TEAPOT_SCALE, TEAPOT_SCALE, -TEAPOT_SCALE)
    g_modelMatrix3 = new Matrix4().scale(TEAPOT_SCALE, TEAPOT_SCALE, -TEAPOT_SCALE)

    // Place our teapots in the world next to each other
    g_worldMatrix1 = new Matrix4().translate(-1, 0, 0)
    g_worldMatrix2 = new Matrix4().translate(0, 0, 0)
    g_worldMatrix3 = new Matrix4().translate(1, 0, 0)

    // Initially place the camera in "front" and above the teapot a bit
    g_cameraDistance = 2.0
    g_cameraAngle = 90
    g_cameraHeight = .2

    // Setup an ortho matrix for our larger canvas
    g_projectionMatrix = new Matrix4().setOrtho(-6/4, 6/4, -1, 1, .1, 500)

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

    tick()
}

// extra constants for cleanliness
const ROTATION_SPEED = .05
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

    // rotate each teapot constantly around the Y axis of the model
    angle = ROTATION_SPEED * deltaTime
    g_modelMatrix1 = new Matrix4().setRotate(angle, 0, 1, 0).concat(g_modelMatrix1)
    g_modelMatrix2 = new Matrix4().setRotate(angle, 0, 1, 0).concat(g_modelMatrix2)
    g_modelMatrix3 = new Matrix4().setRotate(angle, 0, 1, 0).concat(g_modelMatrix3)

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

// TODO: Constants for you to modify
// Note that (conceptually) we are modifying how the light hits each teapot
//   rather than modifying the material of the teapot directly
METAL_TEAPOT_AMBIENT_COLOR  = [.05, .05, .05]
METAL_TEAPOT_DIFFUSE_COLOR  = [.6, .6, .65]
METAL_TEAPOT_SPECULAR_COLOR = [.9, .9, .7]
METAL_TEAPOT_SPECULAR_POWER = 128

CERAMIC_TEAPOT_AMBIENT_COLOR  = [0, 0, 0]
CERAMIC_TEAPOT_DIFFUSE_COLOR  = [0, .2, 1]
CERAMIC_TEAPOT_SPECULAR_COLOR = [1, 1, 1]
CERAMIC_TEAPOT_SPECULAR_POWER = 16

PLASTIC_TEAPOT_AMBIENT_COLOR  = [.2, .1, .1]
PLASTIC_TEAPOT_DIFFUSE_COLOR  = [.8, .1, .3]
PLASTIC_TEAPOT_SPECULAR_COLOR = [.3, .4, .4]
PLASTIC_TEAPOT_SPECULAR_POWER = 2

// draw to the screen on the next frame
function draw() {
    // Calculate the camera position from our angle and height
    // we get to use a bit of clever 2D rotation math
    // note that we can only do this because we're "fixing" our plane of motion
    // if we wanted to allow arbitrary rotation, we would want quaternions!
    var cameraPosition = new Vector3()
    cameraPosition.x = Math.cos(Math.PI * g_cameraAngle / 180)
    cameraPosition.y = g_cameraHeight
    cameraPosition.z = Math.sin(Math.PI * g_cameraAngle / 180)
    cameraPosition.normalize()
    
    // calculate distance and turn into an array for matrix entry
    var cameraPositionArray = [
        cameraPosition.x * g_cameraDistance,
        cameraPosition.y * g_cameraDistance,
        cameraPosition.z * g_cameraDistance
    ]

    // Build a new lookat matrix each frame
    cameraMatrix = new Matrix4().setLookAt(...cameraPositionArray, 0, 0, 0, 0, 1, 0)

    // Clear the canvas with a black background
    gl.clearColor(0.0, 0.0, 0.0, 1.0)
    gl.clear(gl.COLOR_BUFFER_BIT)

    // Use the same camera and projection matrix for everything
    gl.uniformMatrix4fv(g_u_camera_ref, false, cameraMatrix.elements)
    gl.uniformMatrix4fv(g_u_projection_ref, false, g_projectionMatrix.elements)

    // Update with our light position to be behind the camera
    gl.uniform3fv(g_u_light_ref, new Float32Array(g_lightPosition))

    // Set the location of the first teapot
    gl.uniformMatrix4fv(g_u_model_ref, false, g_modelMatrix1.elements)
    gl.uniformMatrix4fv(g_u_world_ref, false, g_worldMatrix1.elements)
    var inverseTranspose = new Matrix4(g_worldMatrix1).multiply(g_modelMatrix1)
    inverseTranspose.invert().transpose()
    gl.uniformMatrix4fv(g_u_inversetranspose_ref, false, inverseTranspose.elements)

    // Set the colors of the first teapot
    gl.uniform3fv(g_u_ambient_ref, new Float32Array(METAL_TEAPOT_AMBIENT_COLOR))
    gl.uniform3fv(g_u_diffuse_ref, new Float32Array(METAL_TEAPOT_DIFFUSE_COLOR))
    gl.uniform3fv(g_u_specular_ref, new Float32Array(METAL_TEAPOT_SPECULAR_COLOR))
    gl.uniform1f(g_u_specpower_ref, METAL_TEAPOT_SPECULAR_POWER)

    // Draw the first teapot
    gl.drawArrays(gl.TRIANGLES, 0, g_teapotMesh.length / 3)

    // Set the location of the second teapot
    gl.uniformMatrix4fv(g_u_model_ref, false, g_modelMatrix2.elements)
    gl.uniformMatrix4fv(g_u_world_ref, false, g_worldMatrix2.elements)
    var inverseTranspose = new Matrix4(g_worldMatrix2).multiply(g_modelMatrix2)
    inverseTranspose.invert().transpose()
    gl.uniformMatrix4fv(g_u_inversetranspose_ref, false, inverseTranspose.elements)

    // Set the colors of the second teapot
    gl.uniform3fv(g_u_ambient_ref, new Float32Array(CERAMIC_TEAPOT_AMBIENT_COLOR))
    gl.uniform3fv(g_u_diffuse_ref, new Float32Array(CERAMIC_TEAPOT_DIFFUSE_COLOR))
    gl.uniform3fv(g_u_specular_ref, new Float32Array(CERAMIC_TEAPOT_SPECULAR_COLOR))
    gl.uniform1f(g_u_specpower_ref, CERAMIC_TEAPOT_SPECULAR_POWER)

    // Draw the second teapot
    gl.drawArrays(gl.TRIANGLES, 0, g_teapotMesh.length / 3)

    // Set the location of the third teapot
    gl.uniformMatrix4fv(g_u_model_ref, false, g_modelMatrix3.elements)
    gl.uniformMatrix4fv(g_u_world_ref, false, g_worldMatrix3.elements)
    var inverseTranspose = new Matrix4(g_worldMatrix3).multiply(g_modelMatrix3)
    inverseTranspose.invert().transpose()
    gl.uniformMatrix4fv(g_u_inversetranspose_ref, false, inverseTranspose.elements)

    // Set the colors of the third teapot
    gl.uniform3fv(g_u_ambient_ref, new Float32Array(PLASTIC_TEAPOT_AMBIENT_COLOR))
    gl.uniform3fv(g_u_diffuse_ref, new Float32Array(PLASTIC_TEAPOT_DIFFUSE_COLOR))
    gl.uniform3fv(g_u_specular_ref, new Float32Array(PLASTIC_TEAPOT_SPECULAR_COLOR))
    gl.uniform1f(g_u_specpower_ref, PLASTIC_TEAPOT_SPECULAR_POWER)

    // Draw the third teapot
    gl.drawArrays(gl.TRIANGLES, 0, g_teapotMesh.length / 3)
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