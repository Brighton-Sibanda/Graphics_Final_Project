// Last edited by Dietrich Geisler 2024

const VSHADER_SOURCE_FIRST = `
    attribute vec3 a_Position;
    uniform mat4 u_Model;
    uniform mat4 u_World;
    uniform mat4 u_Camera;
    uniform mat4 u_Projection;

    attribute vec3 a_Color;
    varying vec3 v_Color;
    void main() {
        gl_Position = u_Projection * u_Camera * 
            u_World * u_Model * vec4(a_Position, 1);
        v_Color = a_Color;
    }
`

const FSHADER_SOURCE_FIRST = `
    precision highp float;
    varying vec3 v_Color;
    void main() {
        gl_FragColor = vec4(v_Color, 1);
    }
`

const VSHADER_SOURCE_SECOND = `
    attribute vec3 a_Position;
    uniform mat4 u_Model;
    uniform mat4 u_World;
    uniform mat4 u_Camera;
    uniform mat4 u_Projection;
    attribute vec2 a_TexCoord;
    varying vec2 v_TexCoord;
    void main() {
        gl_Position = u_Projection * u_Camera * 
            u_World * u_Model * vec4(a_Position, 1);
        v_TexCoord = a_TexCoord;
    }
`

const FSHADER_SOURCE_SECOND = `
    precision highp float;
    varying vec2 v_TexCoord;
    uniform sampler2D u_Texture;
    void main() {
        gl_FragColor = texture2D(u_Texture, v_TexCoord);
    }
`

// references to compiled shaders
var g_programInner
var g_programOuter

// references to general information
var g_canvas
var gl
var g_lastFrameMS

// uniform references for program 1
var g_u_model_ref1
var g_u_world_ref1
var g_u_camera_ref1
var g_u_projection_ref1

// uniform references for program 2
var g_u_model_ref2
var g_u_world_ref2
var g_u_camera_ref2
var g_u_projection_ref2
var g_u_texture_ref2

// cube 1 matrices
var g_modelMatrix1
var g_worldMatrix1

// cube 2 matrices
var g_model_matrix2
var g_modelMatrix2

// Camera/Projection
var g_cameraMatrix
var g_projectionMatrix

// the current axis of rotation for both cubes
var g_rotation_axis

// color array
var g_cubeColors

// texture information
var g_framebuffer
var g_dataTexture
var g_dataTextureWidth // we need texture width/height for setting the viewport
var g_dataTextureHeight
var g_u_texture

// texture constants

DATA_TEXTURE_WIDTH = 256
DATA_TEXTURE_HEIGHT = 256

// Unit cube mesh, size 2x2x2, oriented around zero
const CUBE_MESH = [
    // front face
    1, 1, 1,
    -1, 1, 1,
    -1, -1, 1,

    1, 1, 1,
    -1, -1, 1,
    1, -1, 1,

    // back face
    1, 1, -1,
    -1, -1, -1,
    -1, 1, -1,

    1, 1, -1,
    1, -1, -1,
    -1, -1, -1,

    // right face
    1, 1, 1,
    1, -1, -1,
    1, 1, -1,

    1, 1, 1,
    1, -1, 1,
    1, -1, -1,

    // left face
    -1, 1, 1,
    -1, 1, -1,
    -1, -1, -1,

    -1, 1, 1,
    -1, -1, -1,
    -1, -1, 1,

    // top face
    1, 1, 1,
    1, 1, -1,
    -1, 1, -1,

    1, 1, 1,
    -1, 1, -1,
    -1, 1, 1,

    // bottom face
    1, -1, 1,
    -1, -1, -1,
    1, -1, -1,

    1, -1, 1,
    -1, -1, 1,
    -1, -1, -1,
]

const CUBE_TEX_MAPPING = [
    // front face
    1, 1,
    0, 1,
    0, 0,
    1, 1,
    0, 0,
    1, 0,

    // back face
    1, 0,
    0, 1,
    0, 0,
    1, 0,
    1, 1,
    0, 1,

    // right face
    0, 1,
    1, 0,
    1, 1,
    0, 1,
    0, 0,
    1, 0,

    // left face
    1, 1,
    0, 1,
    0, 0,
    1, 1,
    0, 0,
    1, 0,

    // top face
    1, 0,
    1, 1,
    0, 1,
    1, 0,
    0, 1,
    0, 0,

    // bottom face
    1, 1,
    0, 0,
    1, 0,
    1, 1,
    0, 1,
    0, 0,
]

// We're using triangles, so our primitives each have 3 elements
const TRIANGLE_SIZE = 3

// The size in bytes of a floating point
const FLOAT_SIZE = 4

function main() {
    g_canvas = document.getElementById('canvas')

    // Get the rendering context for WebGL
    gl = getWebGLContext(g_canvas, true)
    if (!gl) {
        console.log('Failed to get the rendering context for WebGL')
        return
    }

    // Initialize GPU's vertex and fragment shaders programs
    g_programInner = createProgram(gl, VSHADER_SOURCE_FIRST, FSHADER_SOURCE_FIRST)
    if (!g_programInner) {
        console.log('Failed to create program')
        return
    }

    // Initialize a _second_ set of vertex and fragment shaders
    g_programOuter = createProgram(gl, VSHADER_SOURCE_SECOND, FSHADER_SOURCE_SECOND)
    if (!g_programOuter) {
        console.log('Failed to create program')
        return
    }

    // put the texture attributes after our mesh, followed by our colors
    // note that we will send attributes to memory once,
    //  but we will need to refer to the VBO locations for _each program_
    g_cubeColors = buildColorAttributes(CUBE_MESH.length / 3)
    var data = CUBE_MESH
        .concat(g_cubeColors)
        .concat(CUBE_TEX_MAPPING)

    if (!initVBO(new Float32Array(data))) {
        return
    }

    // get uniform references for our first program
    g_u_model_ref1 = gl.getUniformLocation(g_programInner, 'u_Model')
    g_u_world_ref1 = gl.getUniformLocation(g_programInner, 'u_World')
    g_u_camera_ref1 = gl.getUniformLocation(g_programInner, 'u_Camera')
    g_u_projection_ref1 = gl.getUniformLocation(g_programInner, 'u_Projection')

    // get uniform references for our second program
    g_u_model_ref2 = gl.getUniformLocation(g_programOuter, 'u_Model')
    g_u_world_ref2 = gl.getUniformLocation(g_programOuter, 'u_World')
    g_u_camera_ref2 = gl.getUniformLocation(g_programOuter, 'u_Camera')
    g_u_projection_ref2 = gl.getUniformLocation(g_programOuter, 'u_Projection')

    // setup our initial matrices
    g_modelMatrix1 = new Matrix4().scale(.5, .5, .5)
    g_modelMatrix2 = new Matrix4().scale(.5, .5, .5)
    g_worldMatrix1 = new Matrix4().translate(0, 0, -1)
    g_worldMatrix2 = new Matrix4().translate(0, 0, -1)

    // use the same camera/projection for both cubes
    g_cameraMatrix = new Matrix4()
    g_projectionMatrix = new Matrix4().setOrtho(-1, 1, -1, 1, .1, 10)

    // https://webglfundamentals.org/webgl/lessons/webgl-render-to-texture.html
    // Create a texture to write data to
    g_dataTexture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, g_dataTexture)

    // Note the null data, we'll rely on the shader to build this texture
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA,
        DATA_TEXTURE_WIDTH, DATA_TEXTURE_HEIGHT, 0,
        gl.RGBA, gl.UNSIGNED_BYTE, null);

    // Filter so we don't need a mipmap (linear is fine)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)

    // create a framebuffer so we can refer to the data from rendering the scene
    g_framebuffer = gl.createFramebuffer()
    gl.bindFramebuffer(gl.FRAMEBUFFER, g_framebuffer)

    // setup a framebuffer location to map to g_dataTexture
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, g_dataTexture, 0)

    // create a depth renderbuffer so we get proper depth culling in the framebuffer
    // match the sizes with the targetTexture
    var depth_buffer = gl.createRenderbuffer()
    gl.bindRenderbuffer(gl.RENDERBUFFER, depth_buffer)
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, DATA_TEXTURE_WIDTH, DATA_TEXTURE_HEIGHT)
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depth_buffer)

    // Enable culling and depth for both programs
    gl.enable(gl.CULL_FACE)
    gl.enable(gl.DEPTH_TEST)

    // Setup for ticks
    g_lastFrameMS = Date.now()
    g_rotation_axis = [1, 0, 0]

    tick()
}

// extra constants for cleanliness
const ROTATION_SPEED_1 = 0.08
const ROTATION_SPEED_2 = 0.03

// function to apply all the logic for a single frame tick
function tick() {
    // time since the last frame
    var deltaTime

    // calculate deltaTime
    var current_time = Date.now()
    deltaTime = current_time - g_lastFrameMS
    g_lastFrameMS = current_time

    // rotate the first matrix constantly
    angle1 = ROTATION_SPEED_1 * deltaTime
    g_modelMatrix1.concat(new Matrix4().setRotate(angle1, ...g_rotation_axis))
    angle2 = ROTATION_SPEED_2 * deltaTime
    g_modelMatrix2.concat(new Matrix4().setRotate(angle2, ...g_rotation_axis))

    draw()

    requestAnimationFrame(tick, g_canvas)
}

// draw to the screen on the next frame
function draw() {
    // First, set our draw location to be our constructed frame buffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, g_framebuffer)
    // gl.bindFramebuffer(gl.FRAMEBUFFER, null)

    // now clear the canvas with a red background
    gl.clearColor(.8, 0, 0, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.clear(gl.DEPTH_BUFFER_BIT)
    // set the viewport to be the size of our target texture
    gl.viewport(0, 0, DATA_TEXTURE_WIDTH, DATA_TEXTURE_HEIGHT)

    // then draw the inner cube to this framebuffer
    drawInnerCube()

    // Second, clear the frame buffer to draw to the screen as normal
    // must be done before changing other stuff!
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)

    // Now, clear the canvas _again_ and reset the viewport
    gl.clearColor(0, 0, 0, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.clear(gl.DEPTH_BUFFER_BIT)
    gl.viewport(0, 0, g_canvas.width, g_canvas.height)

    // then draw the outer cube to the screen
    drawOuterCube()
}

function drawInnerCube() {
    // use our first program
    gl.useProgram(g_programInner)

    // rebind our attributes to the first program

    if (setupVec(3, g_programInner, 'a_Position', 0, 0) < 0) {
        return -1
    }
    if (setupVec(3, g_programInner, 'a_Color', 0, CUBE_MESH.length * FLOAT_SIZE) < 0) {
        return -1
    }

    // setup the inner cube
    gl.uniformMatrix4fv(g_u_model_ref1, false, g_modelMatrix1.elements)
    gl.uniformMatrix4fv(g_u_world_ref1, false, g_worldMatrix1.elements)
    gl.uniformMatrix4fv(g_u_camera_ref1, false, g_cameraMatrix.elements)
    gl.uniformMatrix4fv(g_u_projection_ref1, false, g_projectionMatrix.elements)

    // execute a draw call
    gl.drawArrays(gl.TRIANGLES, 0, CUBE_MESH.length / TRIANGLE_SIZE)
}

function drawOuterCube() {
    // use our second program
    gl.useProgram(g_programOuter)

    if (setupVec(3, g_programOuter, 'a_Position', 0, 0) < 0) {
        return -1
    }
    if (setupVec(2, g_programOuter, 'a_TexCoord', 0,
            (CUBE_MESH.length + g_cubeColors.length) * FLOAT_SIZE) < 0) {
        return -1
    }

    // setup the outer cube
    gl.uniformMatrix4fv(g_u_model_ref2, false, g_modelMatrix2.elements)
    gl.uniformMatrix4fv(g_u_world_ref2, false, g_worldMatrix2.elements)
    gl.uniformMatrix4fv(g_u_camera_ref2, false, g_cameraMatrix.elements)
    gl.uniformMatrix4fv(g_u_projection_ref2, false, g_projectionMatrix.elements)

    // assign our texture as the data texture created earlier
    gl.uniform1i(g_u_texture_ref2, g_dataTexture)

    // execute a draw call
    gl.drawArrays(gl.TRIANGLES, 0, CUBE_MESH.length / TRIANGLE_SIZE)
}

// Helper to construct colors
// makes every triangle a slightly different shade of blue
function buildColorAttributes(vertex_count) {
    var colors = []
    for (var i = 0; i < vertex_count / 3; i++) {
        // three vertices per triangle
        for (var vert = 0; vert < 3; vert++) {
            var shade = (i * 3) / vertex_count
            colors.push(shade, shade, 1)
        }
    }

    return colors
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