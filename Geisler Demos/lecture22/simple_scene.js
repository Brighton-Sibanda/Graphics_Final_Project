// Last edited by Dietrich Geisler 2025

// GLSL shaders to compile
var g_vshaderPhong
var g_fshaderPhong
var g_vshaderFlat
var g_fshaderFlat

// references to the compiled programs
var g_programPhong
var g_programFlat

// matrices
var g_modelMatrixTeapot
var g_worldMatrixTeapot
var g_modelMatrixFloor
var g_worldMatrixFloor
var g_projectionMatrix

// references to general information
var g_canvas
var gl
var g_lastFrameMS

// phong uniform references
var g_model_ref_phong
var g_world_ref_phong
var g_camera_ref_phong
var g_projection_ref_phong
var g_inverse_transpose_ref_phong
var g_light_ref_phong
var g_ambient_color_ref_phong
var g_diffuse_color_ref_phong
var g_spec_power_ref_phong
var g_spec_color_ref_phong

// flat lighting references
var g_model_ref_flat
var g_world_ref_flat
var g_camera_ref_flat
var g_projection_ref_flat

// keep track of the camera position, always looking at the world center
var g_cameraDistance
var g_cameraAngle
var g_cameraHeight

// global parameters
var g_lightPosition

// Key states
var g_movingUp
var g_movingDown
var g_movingLeft
var g_movingRight
var g_movingForward
var g_movingBackward

// constants
const TEAPOT_Z_OFFSET = -2
const TEAPOT_Z_CENTER = -1
const FLOAT_SIZE = 4

function main() {
    // Listen for slider changes
    slider_input = document.getElementById('sliderLightX')
    slider_input.addEventListener('input', (event) => {
        updateLightX(event.target.value)
    })
    slider_input = document.getElementById('sliderLightY')
    slider_input.addEventListener('input', (event) => {
        updateLightY(event.target.value)
    })
    slider_input = document.getElementById('sliderLightZ')
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
    g_vshaderPhong = await fetch('./phong.vert').then(response => response.text()).then((x) => x)
    g_fshaderPhong = await fetch('./phong.frag').then(response => response.text()).then((x) => x)
    g_vshaderFlat = await fetch('./flat.vert').then(response => response.text()).then((x) => x)
    g_fshaderFlat = await fetch('./flat.frag').then(response => response.text()).then((x) => x)

    // wait until everything is loaded before rendering
    startRendering()
}

function startRendering() {
    // Compile all of the vshaders and fshaders
    g_programPhong = createProgram(gl, g_vshaderPhong, g_fshaderPhong)
    if (!g_programPhong) {
        console.log('Failed to intialize shaders.')
        return
    }
    g_programFlat = createProgram(gl, g_vshaderFlat, g_fshaderFlat)
    if (!g_programFlat) {
        console.log('Failed to intialize shaders.')
        return
    }

    var data = g_teapotMesh.concat(CUBE_MESH).concat(g_teapotNormals).concat(CUBE_NORMALS)
    if (!initVBO(new Float32Array(data))) {
        return
    }

    // reference to our pointers
    g_model_ref_phong = gl.getUniformLocation(g_programPhong, 'u_Model')
    g_world_ref_phong = gl.getUniformLocation(g_programPhong, 'u_World')
    g_camera_ref_phong = gl.getUniformLocation(g_programPhong, 'u_Camera')
    g_projection_ref_phong = gl.getUniformLocation(g_programPhong, 'u_Projection')
    g_inverse_transpose_ref_phong = gl.getUniformLocation(g_programPhong, 'u_ModelWorldInverseTranspose')
    g_light_ref_phong = gl.getUniformLocation(g_programPhong, 'u_Light')
    g_ambient_color_ref_phong = gl.getUniformLocation(g_programPhong, 'u_AmbientColor')
    g_diffuse_color_ref_phong = gl.getUniformLocation(g_programPhong, 'u_DiffuseColor')
    g_spec_power_ref_phong = gl.getUniformLocation(g_programPhong, 'u_SpecPower')
    g_spec_color_ref_phong = gl.getUniformLocation(g_programPhong, 'u_SpecColor')

    g_model_ref_flat = gl.getUniformLocation(g_programFlat, 'u_Model')
    g_world_ref_flat = gl.getUniformLocation(g_programFlat, 'u_World')
    g_camera_ref_flat = gl.getUniformLocation(g_programFlat, 'u_Camera')
    g_projection_ref_flat = gl.getUniformLocation(g_programFlat, 'u_Projection')

    // setup our teapot with heavy scaling
    g_modelMatrixTeapot = new Matrix4().setScale(.02, .02, -.02)
    g_worldMatrixTeapot = new Matrix4().translate(0, 1, TEAPOT_Z_OFFSET)

    // Make a large and thin floor, below the teapot
    g_modelMatrixFloor = new Matrix4().setScale(30., 2., 30.)
    g_worldMatrixFloor = new Matrix4().translate(0, -3., 10)

    // Setup a "reasonable" perspective matrix
    g_projectionMatrix = new Matrix4().setPerspective(90, 1, .1, 500)

    gl.enable(gl.CULL_FACE)
    gl.enable(gl.DEPTH_TEST)

    // Setup for ticks
    g_lastFrameMS = Date.now()

    // Initialize our data
    g_cameraDistance = 5
    g_cameraAngle = 100
    g_cameraHeight = 1
    g_lightPosition = [0, 0, 0]
    updateLightX(3)
    updateLightY(3)
    updateLightZ(0)

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

    // rotate the teapot constantly around a set point
    g_worldMatrixTeapot.translate(0, 0, TEAPOT_Z_CENTER - TEAPOT_Z_OFFSET)
        .rotate(-deltaTime * ROTATION_SPEED, 0, 1, 0)
        .translate(0, 0, TEAPOT_Z_OFFSET - TEAPOT_Z_CENTER)

    updateCameraMovement(deltaTime)

    draw()

    requestAnimationFrame(tick, g_canvas)
}

// draw to the screen on the next frame
function draw() {
    // Clear the canvas with a black background
    gl.clearColor(0.0, 0.0, 0.0, 1.0)
    gl.clear(gl.COLOR_BUFFER_BIT)

    usePhongProgram()

    // setup our camera and projection a
    cameraMatrix = calculateCameraMatrix()
    gl.uniformMatrix4fv(g_camera_ref_phong, false, cameraMatrix.elements)
    gl.uniformMatrix4fv(g_projection_ref_phong, false, g_projectionMatrix.elements)

    // add our light
    gl.uniform3fv(g_light_ref_phong, new Float32Array(g_lightPosition))

    // Setup the teapot matrices
    gl.uniformMatrix4fv(g_model_ref_phong, false, g_modelMatrixTeapot.elements)
    gl.uniformMatrix4fv(g_world_ref_phong, false, g_worldMatrixTeapot.elements)
    var inv = new Matrix4(g_worldMatrixTeapot)
        .concat(g_modelMatrixTeapot)
        .invert().transpose()
    gl.uniformMatrix4fv(g_inverse_transpose_ref_phong, false, inv.elements)

    // set a position and colors for the teapot, and draw
    gl.uniform3fv(g_ambient_color_ref_phong, new Float32Array([0, 0, 0]))
    gl.uniform3fv(g_diffuse_color_ref_phong, new Float32Array([0.1, .5, .8]))
    gl.uniform1f(g_spec_power_ref_phong, 256.0)
    gl.uniform3fv(g_spec_color_ref_phong, new Float32Array([1, 1, 1]))

    gl.drawArrays(gl.TRIANGLES, 0, g_teapotMesh.length / 3)

    // Setup the floor matrices
    gl.uniformMatrix4fv(g_model_ref_phong, false, g_modelMatrixFloor.elements)
    gl.uniformMatrix4fv(g_world_ref_phong, false, g_worldMatrixFloor.elements)
    var inv = new Matrix4(g_worldMatrixFloor)
        .concat(g_modelMatrixFloor)
        .invert().transpose()
    gl.uniformMatrix4fv(g_inverse_transpose_ref_phong, false, inv.elements)

    // set a position and colors for the floor, and draw
    gl.uniform3fv(g_ambient_color_ref_phong, new Float32Array([.4, .25, .1]))
    gl.uniform3fv(g_diffuse_color_ref_phong, new Float32Array([.3, .3, .3]))
    gl.uniform1f(g_spec_power_ref_phong, 64.0)
    gl.uniform3fv(g_spec_color_ref_phong, new Float32Array([1, 1, 1]))

    gl.drawArrays(gl.TRIANGLES, g_teapotMesh.length / 3, CUBE_MESH.length / 3)

    // draw our cube light
    useFlatProgram()
    gl.uniformMatrix4fv(g_model_ref_flat, false, new Matrix4().scale(.1, .1, .1).elements)
    gl.uniformMatrix4fv(g_world_ref_flat, false, new Matrix4().translate(...g_lightPosition).elements)
    gl.uniformMatrix4fv(g_camera_ref_flat, false, cameraMatrix.elements)
    gl.uniformMatrix4fv(g_projection_ref_flat, false, g_projectionMatrix.elements)

    gl.drawArrays(gl.TRIANGLES, g_teapotMesh.length / 3, CUBE_MESH.length / 3)
}

// helper to setup the phong program with attributes
function usePhongProgram() {
    gl.useProgram(g_programPhong)
    if (!setupVec(3, g_programPhong, 'a_Position', 0, 0)) {
        return
    }
    if (!setupVec(3, g_programPhong, 'a_Normal', 0, FLOAT_SIZE * (g_teapotMesh.length + CUBE_MESH.length))) {
        return
    }
}

// helper to setup the flat program with attributes
function useFlatProgram() {
    gl.useProgram(g_programFlat)
    if (!setupVec(3, g_programFlat, 'a_Position', 0, 0)) {
        return
    }
}

// Calculate the camera position from our angle and height
// we get to use a bit of clever 2D rotation math
// note that we can only do this because we're "fixing" our plane of motion
// if we wanted to allow arbitrary rotation, we would want quaternions!
function calculateCameraMatrix() {
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

    return new Matrix4().setLookAt(...cameraPositionArray, 0, 0, 0, 0, 1, 0)
}

// tick helper to update the camera
function updateCameraMovement(deltaTime) {
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
        g_cameraDistance -= CAMERA_SPEED * deltaTime
        // we don't want to hit a distance of 0
        g_cameraDistance = Math.max(g_cameraDistance, 1.0)
    }
    if (g_movingBackward) {
        g_cameraDistance += CAMERA_SPEED * deltaTime
    }
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

// Event to change which rotation is selected
function updateRotation() {
    var rotateX = document.getElementById('rotateX')
    var rotateY = document.getElementById('rotateY')
    var rotateZ = document.getElementById('rotateZ')

    g_rotation_axis[0] = Number(rotateX.checked)
    g_rotation_axis[1] = Number(rotateY.checked)
    g_rotation_axis[2] = Number(rotateZ.checked)
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
 * For multiple shaders, requires that we provide a program from which to load the attribute
 */
function setupVec(size, program, name, stride, offset) {
    // Get the attribute by name
    var attributeID = gl.getAttribLocation(program, `${name}`)
    if (attributeID < 0) {
        console.log(`Failed to get the storage location of ${name}`)
        return false
    }

    // Set how the GPU fills the a_Position variable with data from the GPU 
    gl.vertexAttribPointer(attributeID, size, gl.FLOAT, false, stride, offset)
    gl.enableVertexAttribArray(attributeID)

    return true
}