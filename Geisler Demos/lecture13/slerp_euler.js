// Last edited by Dietrich Geisler 2025

const VSHADER_SOURCE = `
    attribute vec3 a_Position;
    uniform mat4 u_Model;
    uniform mat4 u_World;
    uniform mat4 u_Camera;
    uniform mat4 u_Projection;
    attribute vec3 a_Color;
    varying vec3 v_Color;
    void main() {
        gl_Position = u_Projection * u_Camera * u_World * u_Model * vec4(a_Position, 1.0);
        v_Color = a_Color;
    }
`

const FSHADER_SOURCE = `
    varying mediump vec3 v_Color;
    void main() {
        gl_FragColor = vec4(v_Color, 1.0);
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

// model/world/camera/projection
var g_modelMatrix
var g_worldMatrix
var g_cameraMatrix
var g_projectionMatrix

// Mesh definition
var g_planeMesh

// The size in bytes of a floating point
const FLOAT_SIZE = 4

function main() {
    // Slider setup
    slider_input = document.getElementById('sliderAlpha')
    slider_input.addEventListener('input', (event) => {
        updateAlpha(event.target.value)
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
    data = await fetch('/resources/plane.obj').then(response => response.text()).then((x) => x)
    g_planeMesh = []
    readObjFile(data, g_planeMesh)

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
    var colors = buildColorAttributes(g_planeMesh.length / 3)
    var data = g_planeMesh.concat(colors)
    if (!initVBO(new Float32Array(data))) {
        return
    }

    // Send our vertex data to the GPU
    if (!setupVec3('a_Position', 0, 0)) {
        return
    }
    if (!setupVec3('a_Color', 0, g_planeMesh.length * FLOAT_SIZE)) {
        return
    }

    // Get references to GLSL uniforms
    g_u_model_ref = gl.getUniformLocation(gl.program, 'u_Model')
    g_u_world_ref = gl.getUniformLocation(gl.program, 'u_World')
    g_u_camera_ref = gl.getUniformLocation(gl.program, 'u_Camera')
    g_u_projection_ref = gl.getUniformLocation(gl.program, 'u_Projection')

    gl_modelMatrix = new Matrix4()

    // Reposition our mesh to fit in the projection
    g_worldMatrix = new Matrix4().translate(0, 0, -2)

    // Initially set our camera to be in a default position
    g_cameraMatrix = new Matrix4()

    // Setup a reasonabl "basic" perspective projection
    g_projectionMatrix = new Matrix4().setPerspective(20, 1, 1, 10)

    // Enable culling and depth
    gl.enable(gl.CULL_FACE)
    gl.enable(gl.DEPTH_TEST)

    // Setup for ticks
    g_lastFrameMS = Date.now()

    // start alpha at 0
    updateAlpha(0)

    tick()
}

// function to apply all the logic for a single frame tick
function tick() {
    // time since the last frame
    var deltaTime

    // calculate deltaTime
    var current_time = Date.now()
    deltaTime = current_time - g_lastFrameMS
    g_lastFrameMS = current_time

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

    gl.drawArrays(gl.TRIANGLES, 0, g_planeMesh.length / 3)
}

function lerp(v1, v2, alpha) {
    return alpha * (v2 - v1) + v1
}

// The constants to lerp between
const MIN_R = 0
const MIN_P = 0
const MIN_Y = 0
const MAX_R = 180
const MAX_P = 180
const MAX_Y = 0

function updateAlpha(value) {
    // Calculate lerp for each angle
    angles = [
        lerp(MIN_R, MAX_R, value), 
        lerp(MIN_P, MAX_P, value), 
        lerp(MIN_Y, MAX_Y, value)
    ]

    // Format the alpha label
    var alphaLabel = document.getElementById('alphaLabel')
    var left = `[${MIN_R}, ${MIN_P}, ${MIN_Y}]`
    var right = `[${MAX_R}, ${MAX_P}, ${MAX_Y}]`
    alphaLabel.textContent = `Alpha: ${value}, from ${left} to ${right}`

    // Format the angle label
    var angleLabel = document.getElementById('angleLabel')
    var r = Number(angles[0]).toFixed(2)
    var p = Number(angles[1]).toFixed(2)
    var y = Number(angles[2]).toFixed(2)
    angleLabel.textContent = `Angle: [${r}, ${p}, ${y}]`

    // apply rotation using alpha
    rotationMatrix = new Matrix4()
    // yaw-pitch-roll (reverse order, as always)
    rotationMatrix.rotate(-r, 1, 0, 0)
    rotationMatrix.rotate(p, 0, 1, 0)
    rotationMatrix.rotate(-y, 0, 0, 1)

    g_modelMatrix = new Matrix4().rotate(90, 1, 0, 0).scale(.01, .01, .01)
    g_modelMatrix = rotationMatrix.multiply(g_modelMatrix)
}

// Helper to construct colors
// makes every triangle a slightly different shade of blue
function buildColorAttributes(vertex_count) {
    var colors = []
    for (var i = 0; i < vertex_count / 3; i++) {
        // three vertices per triangle
        for (var vert = 0; vert < 3; vert++) {
            var shade = (i * 3) / vertex_count
            colors.push(shade, shade, 1.0)
        }
    }

    return colors
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