// Last edited by Dietrich Geisler 2025

const VSHADER_SOURCE = `
    attribute vec3 a_Position;
    uniform mat4 u_Model;
    uniform mat4 u_World;
    uniform mat4 u_Camera;
    uniform mat4 u_Projection;

    uniform vec3 u_Light;
    attribute vec3 a_Color;
    attribute vec3 a_Normal;
    varying vec3 v_Normal;
    void main() {
        gl_Position = u_Projection * u_Camera * u_World 
            * u_Model * vec4(a_Position, 1.0);
        
        // rasterize our normal information
        v_Normal = a_Normal;
    }
`

const FSHADER_SOURCE = `
    precision highp float;
    varying vec3 v_Normal;
    uniform mat4 u_Model;
    uniform vec3 u_Light;
    void main() {
        // set every fragment to have the same "default" color
        vec3 baseColor = vec3(0.4, 0.0, 1.0);

        // Apply our transformation
        // We'll talk about the trickery here with vec4 in Lecture 16
        vec3 rotated = normalize(vec3(u_Model * vec4(v_Normal, 0.0)));

        gl_FragColor = vec4(dot(normalize(u_Light), rotated) * baseColor, 1.0);
    }
`

// references to general information
var g_canvas
var gl
var g_lastFrameMS

// GLSL uniform references
var g_u_model_ref
var g_u_world_ref
var g_u_camera_ref
var g_u_projection_ref

// usual model/world matrices
var g_modelMatrix
var g_worldMatrix
var g_cameraMatrix
var g_projectionMatrix
var g_lightX

// the current axis of rotation
var g_rotationAxis

// Mesh definitions
var g_teapotMesh

// Normal definitions
var g_teapotNormals

// Light X position
var g_lightX

// We're using triangles, so our vertices each have 3 elements
const TRIANGLE_SIZE = 3

// The size in bytes of a floating point
const FLOAT_SIZE = 4

function main() {
    // Setup our sliders
    slider_input = document.getElementById('sliderX')
    slider_input.addEventListener('input', (event) => {
        updateLightX(event.target.value)
    })

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

    // Wait to load our models before starting to render
    startRendering()
}

function startRendering() {
    // Initialize GPU's vertex and fragment shaders programs
    if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) {
        console.log('Failed to intialize shaders.')
        return
    }

    // initialize the VBO
    var data = g_teapotMesh.concat(g_teapotNormals)
    if (!initVBO(new Float32Array(data))) {
        return
    }

    // Send our vertex data to the GPU
    if (!setupVec3('a_Position', 0, 0)) {
        return
    }
    if (!setupVec3('a_Normal', 0, g_teapotMesh.length * FLOAT_SIZE)) {
        return
    }

    // Get references to GLSL uniforms
    g_u_model_ref = gl.getUniformLocation(gl.program, 'u_Model')
    g_u_world_ref = gl.getUniformLocation(gl.program, 'u_World')
    g_u_camera_ref = gl.getUniformLocation(gl.program, 'u_Camera')
    g_u_projection_ref = gl.getUniformLocation(gl.program, 'u_Projection')
    g_u_light_ref = gl.getUniformLocation(gl.program, 'u_Light')

    // Setup and scale our model (down quite a bit)
    g_modelMatrix = new Matrix4().scale(.0001, .0001, -.0001)

    // Place our teapot in the world
    g_worldMatrix = new Matrix4()

    // Look at the teapot
    g_cameraMatrix = new Matrix4().setLookAt(0, 0, 1.5, 0, 0, 0, 0, 1, 0)

    // Setup a "reasonable" perspective matrix
    g_projectionMatrix = new Matrix4().setPerspective(1, 1, .1, 20)

    // Enable culling and depth
    gl.enable(gl.CULL_FACE)
    gl.enable(gl.DEPTH_TEST)

    // Setup for ticks
    g_lastFrameMS = Date.now()

    // initial value declarations
    g_rotationAxis = [0, 0, 0]
    updateRotation()
    updateLightX(0)

    tick()
}

// extra constants for cleanliness
var ROTATION_SPEED = .05

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
    g_modelMatrix.concat(new Matrix4().setRotate(angle, ...g_rotationAxis))

    draw()

    requestAnimationFrame(tick, g_canvas)
}

// draw to the screen on the next frame
function draw() {
    // Clear the canvas with a black background
    gl.clearColor(0.0, 0.0, 0.0, 1.0)
    gl.clear(gl.COLOR_BUFFER_BIT)

    // Update with our global transformation matrices
    gl.uniformMatrix4fv(g_u_model_ref, false, g_modelMatrix.elements)
    gl.uniformMatrix4fv(g_u_world_ref, false, g_worldMatrix.elements)
    gl.uniformMatrix4fv(g_u_camera_ref, false, g_cameraMatrix.elements)
    gl.uniformMatrix4fv(g_u_projection_ref, false, g_projectionMatrix.elements)

    // Update with our light position to be behind the camera
    gl.uniform3f(g_u_light_ref, g_lightX, 0, 2)

    // Draw our teapot
    gl.drawArrays(gl.TRIANGLES, 0, g_teapotMesh.length / 3)
}

// Event to change which rotation is selected
function updateRotation() {
    var rotateX = document.getElementById('rotateX')
    var rotateY = document.getElementById('rotateY')
    var rotateZ = document.getElementById('rotateZ')

    g_rotationAxis[0] = Number(rotateX.checked)
    g_rotationAxis[1] = Number(rotateY.checked)
    g_rotationAxis[2] = Number(rotateZ.checked)
}

function updateLightX(amount) {
    label = document.getElementById('lightX')
    label.textContent = `Light X: ${Number(amount).toFixed(2)}`
    g_lightX = Number(amount)
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