// Last edited by Dietrich Geisler 2025

// references to the GLSL programs we need to load
var g_vshader_pervertex
var g_fshader_pervertex
var g_vshader_skybox
var g_fshader_skybox
var g_vshader_reflection
var g_fshader_reflection

// references to programs
var g_program_pervertex
var g_program_skybox
var g_program_reflection

// references to general information
var g_canvas
var gl
var g_lastFrameMS

// Texture pointers
var g_skyboxTexturePointer
var g_reflectionDataTexture
var g_framebuffer

// GLSL uniform references
var g_u_model_ref_pervertex
var g_u_world_ref_pervertex
var g_u_camera_ref_pervertex
var g_u_projection_ref_pervertex

var g_u_model_ref_reflection
var g_u_world_ref_reflection
var g_u_camera_ref_reflection
var g_u_projection_ref_reflection
var g_u_reflectionBox_ref_reflection
var g_u_cameraworldmodel_inverse_ref_reflection
var g_u_cameraworldmodel_inverse_transpose_ref_reflection

var g_u_skybox_ref_skybox
var g_u_cameraProjectionInverse_ref_skybox

// usual model/world matrices
var g_modelMatrixCube
var g_modelMatrixTeapot
var g_worldMatrixCube
var g_worldMatrixTeapot
var g_projectionMatrix
var g_cubeProjectionMatrix

// keep track of the camera position, always looking at the teapot
var g_cameraDistance
var g_cameraAngle
var g_cameraHeight

// Mesh definitions
var g_teapotMesh
var g_teapotNormals

// global hooks to our loaded images
var g_skyPosX
var g_skyPosY
var g_skyPosZ
var g_skyNegX
var g_skyNegY
var g_skyNegZ

// Key states
var g_movingUp
var g_movingDown
var g_movingLeft
var g_movingRight

// We just need a square mesh to put our texture on!
const SQUARE_MESH = [
    1, 1, 1,
    -1, 1, 1,
    -1, -1, 1,
    1, 1, 1,
    -1, -1, 1,
    1, -1, 1,
]

// Unit cube mesh, size 1, oriented around zero
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

// the size in each dimension of our data texture
const DATA_TEXTURE_WIDTH = 1024
const DATA_TEXTURE_HEIGHT = 1024

// The size in bytes of a floating point
const FLOAT_SIZE = 4

function main() {
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
    // read the obj mesh
    readObjFile(data, g_teapotMesh, g_teapotNormals)

    // load our GLSL files before rendering
    loadImageFiles()
}

/*
 * Helper function to _synchronously_ load image files
 * This can make you quite sad the first time loading an image...
 * But for this class it's "good enough"
 * Feel free to make this asynchronous of course
 */
async function loadImageFiles() {
    g_skyPosX = new Image()
    g_skyPosY = new Image()
    g_skyPosZ = new Image()
    g_skyNegX = new Image()
    g_skyNegY = new Image()
    g_skyNegZ = new Image()
    g_skyPosX.src = "resources/yokohama/posx.jpg"
    g_skyPosY.src = "resources/yokohama/posy.jpg"
    g_skyPosZ.src = "resources/yokohama/posz.jpg"
    g_skyNegX.src = "resources/yokohama/negx.jpg"
    g_skyNegY.src = "resources/yokohama/negy.jpg"
    g_skyNegZ.src = "resources/yokohama/negz.jpg"
    await g_skyPosX.decode()
    await g_skyPosY.decode()
    await g_skyPosZ.decode()
    await g_skyNegX.decode()
    await g_skyNegY.decode()
    await g_skyNegZ.decode()
    
    loadGLSLFiles()
}
    
async function loadGLSLFiles() {
    g_vshader_pervertex = await fetch('./pervertex.vert').then(response => response.text()).then((x) => x)
    g_fshader_pervertex = await fetch('./pervertex.frag').then(response => response.text()).then((x) => x)
    g_vshader_skybox = await fetch('./skybox_raw.vert').then(response => response.text()).then((x) => x)
    g_fshader_skybox = await fetch('./skybox_raw.frag').then(response => response.text()).then((x) => x)
    g_vshader_reflection = await fetch('./reflection.vert').then(response => response.text()).then((x) => x)
    g_fshader_reflection = await fetch('./reflection.frag').then(response => response.text()).then((x) => x)

    // wait until everything is loaded before rendering
    startRendering()
}

function startRendering() {
    // Initialize GPU's vertex and fragment shaders programs
    g_program_pervertex = createProgram(gl, g_vshader_pervertex, g_fshader_pervertex)
    if (!g_program_pervertex) {
        console.log('Failed to create program')
        return
    }
    g_program_skybox = createProgram(gl, g_vshader_skybox, g_fshader_skybox)
    if (!g_program_skybox) {
        console.log('Failed to create program')
        return
    }
    g_program_reflection = createProgram(gl, g_vshader_reflection, g_fshader_reflection)
    if (!g_program_reflection) {
        console.log('Failed to create program')
        return
    }

    // initialize the VBO with grid information / send data to the GPU
    // note that we duplicate some meshes to "fill in" colors/normals
    // we don't _need_ to because multiple shaders, but to avoid headaches when debugging...
    var cubeColors = buildColorAttributes(CUBE_MESH.length / 3)
    var data = SQUARE_MESH.concat(CUBE_MESH).concat(g_teapotMesh)
        .concat(SQUARE_MESH).concat(cubeColors).concat(g_teapotMesh)
        .concat(SQUARE_MESH).concat(CUBE_MESH).concat(g_teapotNormals)
    if (!initVBO(new Float32Array(data))) {
        return
    }

    // Get references to GLSL uniforms for each program
    g_u_model_ref_pervertex = gl.getUniformLocation(g_program_pervertex, 'u_Model')
    g_u_world_ref_pervertex = gl.getUniformLocation(g_program_pervertex, 'u_World')
    g_u_camera_ref_pervertex = gl.getUniformLocation(g_program_pervertex, 'u_Camera')
    g_u_projection_ref_pervertex = gl.getUniformLocation(g_program_pervertex, 'u_Projection')

    g_u_model_ref_reflection = gl.getUniformLocation(g_program_reflection, 'u_Model')
    g_u_world_ref_reflection = gl.getUniformLocation(g_program_reflection, 'u_World')
    g_u_camera_ref_reflection = gl.getUniformLocation(g_program_reflection, 'u_Camera')
    g_u_projection_ref_reflection = gl.getUniformLocation(g_program_reflection, 'u_Projection')
    g_u_reflectionBox_ref_reflection = gl.getUniformLocation(g_program_reflection, 'u_ReflectionBox')
    g_u_cameraworldmodel_inverse_ref_reflection = gl.getUniformLocation(g_program_reflection, 'u_CameraWorldModelInverse')
    g_u_cameraworldmodel_inverse_transpose_ref_reflection = gl.getUniformLocation(g_program_reflection, 'u_CameraWorldModelInverseTranspose')

    g_u_skybox_ref_skybox = gl.getUniformLocation(g_program_skybox, 'u_Skybox')
    g_u_cameraProjectionInverse_ref_skybox = gl.getUniformLocation(g_program_skybox, 'u_CameraProjectionInverse')

    // Setup matrices for the teapot and cube
    g_modelMatrixCube = new Matrix4().scale(.1, .1, .1)
    g_worldMatrixCube = new Matrix4().translate(0, 0, -1)
    g_modelMatrixTeapot = new Matrix4().scale(.01, .01, -.01)
    g_worldMatrixTeapot = new Matrix4()

    // Initially place the camera in "front" and above the teapot a bit
    g_cameraDistance = 2
    g_cameraAngle = 90
    g_cameraHeight = .2

    // Setup a "reasonable" perspective matrix
    g_projectionMatrix = new Matrix4().setPerspective(90, 1, .1, 500)
    // we need a slightly wider perspective matrix for the cubemap management
    g_cubeProjectionMatrix = new Matrix4().setPerspective(160, 1, .1, 10)

    // Setup our cube map
    // https://webglfundamentals.org/webgl/lessons/webgl-cube-maps.html
    g_skyboxTexturePointer = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, g_skyboxTexturePointer)

    // Bind a texture to each cube map slot
    gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, g_skyPosX)
    gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_Y, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, g_skyPosY)
    gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_Z, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, g_skyPosZ)
    gl.texImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_X, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, g_skyNegX)
    gl.texImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_Y, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, g_skyNegY)
    gl.texImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_Z, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, g_skyNegZ)

    // Set parameters of that texture
    gl.generateMipmap(gl.TEXTURE_CUBE_MAP)

    // Setup a reflection map to read into using the framebuffer later
    // https://webglfundamentals.org/webgl/lessons/webgl-render-to-texture.html
    // Create a texture to write data to
    g_reflectionDataTexture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, g_reflectionDataTexture)

    // setup a texture for each edge of the data texture cube map
    gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X, 0, gl.RGBA,
        DATA_TEXTURE_WIDTH, DATA_TEXTURE_HEIGHT, 0,
        gl.RGBA, gl.UNSIGNED_BYTE, null)
    gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_Y, 0, gl.RGBA,
        DATA_TEXTURE_WIDTH, DATA_TEXTURE_HEIGHT, 0,
        gl.RGBA, gl.UNSIGNED_BYTE, null)
    gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_Z, 0, gl.RGBA,
        DATA_TEXTURE_WIDTH, DATA_TEXTURE_HEIGHT, 0,
        gl.RGBA, gl.UNSIGNED_BYTE, null)
    gl.texImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_X, 0, gl.RGBA,
        DATA_TEXTURE_WIDTH, DATA_TEXTURE_HEIGHT, 0,
        gl.RGBA, gl.UNSIGNED_BYTE, null)
    gl.texImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_Y, 0, gl.RGBA,
        DATA_TEXTURE_WIDTH, DATA_TEXTURE_HEIGHT, 0,
        gl.RGBA, gl.UNSIGNED_BYTE, null)
    gl.texImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_Z, 0, gl.RGBA,
        DATA_TEXTURE_WIDTH, DATA_TEXTURE_HEIGHT, 0,
        gl.RGBA, gl.UNSIGNED_BYTE, null)

    // Filter so we don't need a mipmap (linear is fine)
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR)

    // create a framebuffer so we can refer to the data from rendering the scene for each direction
    g_framebuffer = gl.createFramebuffer()
    gl.bindFramebuffer(gl.FRAMEBUFFER, g_framebuffer)

    // create a depth renderbuffer so we get proper depth culling in the framebuffer
    var depth_buffer = gl.createRenderbuffer()
    gl.bindRenderbuffer(gl.RENDERBUFFER, depth_buffer)
        
    // make a depth buffer and the same size as the targetTexture
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, DATA_TEXTURE_WIDTH, DATA_TEXTURE_HEIGHT)
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depth_buffer)

    // Enable culling and depth
    gl.enable(gl.CULL_FACE)
    gl.enable(gl.DEPTH_TEST)

    // Setup for ticks
    g_lastFrameMS = Date.now()

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

    // Rotate the cube around the teapot at some fixed distance
    angle = ROTATION_SPEED * deltaTime
    g_worldMatrixCube = new Matrix4().setRotate(angle, 1, 1, 0).concat(g_worldMatrixCube)

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

    draw()

    requestAnimationFrame(tick, g_canvas)
}

// draw to the screen on the next frame
function draw() {
    // draw the scene six times (one for each direction from the teapot)
    // assume that the teapot is at zero for this example for "simplicity"
    gl.bindFramebuffer(gl.FRAMEBUFFER, g_framebuffer)
    gl.viewport(0, 0, DATA_TEXTURE_WIDTH, DATA_TEXTURE_HEIGHT)

    // This whole setup is slightly wrong
    // But I can't for the life of me figure out why
    // Close enough though
    var reflectionCamera = new Matrix4().setLookAt(0, 0, 1, 0, 0, -1, 0, 1, 0).rotate(270, 0, 1, 0)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_CUBE_MAP_POSITIVE_X, g_reflectionDataTexture, 0)
    drawScene(reflectionCamera)

    reflectionCamera = reflectionCamera.setLookAt(0, 0, 1, 0, 0, -1, 0, 1, 0).rotate(90, 0, 1, 0)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_CUBE_MAP_NEGATIVE_X, g_reflectionDataTexture, 0)
    drawScene(reflectionCamera)

    reflectionCamera = reflectionCamera.setLookAt(0, 0, 1, 0, 0, -1, 0, 1, 0).rotate(270, 1, 0, 0)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_CUBE_MAP_NEGATIVE_Y, g_reflectionDataTexture, 0)
    drawScene(reflectionCamera)

    reflectionCamera = reflectionCamera.setLookAt(0, 0, 1, 0, 0, -1, 0, 1, 0).rotate(90, 1, 0, 0)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_CUBE_MAP_POSITIVE_Y, g_reflectionDataTexture, 0)
    drawScene(reflectionCamera)

    reflectionCamera = reflectionCamera.setLookAt(0, 0, 1, 0, 0, -1, 0, 1, 0).rotate(180, 0, 1, 0)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_CUBE_MAP_POSITIVE_Z, g_reflectionDataTexture, 0)
    drawScene(reflectionCamera)

    reflectionCamera = reflectionCamera.setLookAt(0, 0, 1, 0, 0, -1, 0, 1, 0).rotate(0, 0, 1, 0)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_CUBE_MAP_NEGATIVE_Z, g_reflectionDataTexture, 0)
    drawScene(reflectionCamera)

    // now that we have our data, draw the entire scene with reflections
    var cameraMatrix = calculateCameraMatrix()
    // Clear the canvas with a black background
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.clearColor(0.0, 0.0, 0.0, 1.0)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
    gl.viewport(0, 0, g_canvas.width, g_canvas.height)
    drawScene(cameraMatrix)
    drawTeapot(cameraMatrix)
}

// calculate the camera based on user movement
function calculateCameraMatrix() {
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
    return new Matrix4().setLookAt(...cameraPositionArray, 0, 0, 0, 0, 1, 0)
}

// Draw the entire scene (minus the teapot) from the perspective of the given camera
function drawScene(cameraMatrix) {
    // Clear color and depth everytime we draw the scene
    gl.clearColor(0.0, 0.0, 0.0, 1.0)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

    // Calculate the inverse of our camera + projection for the skybox
    var cameraProjectionInverse = new Matrix4(g_cubeProjectionMatrix).multiply(cameraMatrix)
    cameraProjectionInverse.invert()

    // Setup the skybox
    useSkybox()
    gl.uniformMatrix4fv(g_u_cameraProjectionInverse_ref_skybox, false, cameraProjectionInverse.elements)

    // Set our texture to our cubemap
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, g_skyboxTexturePointer)
    gl.uniform1i(g_u_skybox_ref_skybox, g_skyboxTexturePointer)

    // Draw the skybox square with texture sampling
    gl.drawArrays(gl.TRIANGLES, 0, SQUARE_MESH.length / 3)

    // Draw the cube with per-vertex colors
    usePerVertex()
    gl.uniformMatrix4fv(g_u_model_ref_pervertex, false, g_modelMatrixCube.elements)
    gl.uniformMatrix4fv(g_u_world_ref_pervertex, false, g_worldMatrixCube.elements)
    gl.uniformMatrix4fv(g_u_camera_ref_pervertex, false, cameraMatrix.elements)
    gl.uniformMatrix4fv(g_u_projection_ref_pervertex, false, g_projectionMatrix.elements)

    // draw our cube
    gl.drawArrays(gl.TRIANGLES, SQUARE_MESH.length / 3, CUBE_MESH.length / 3)
}

// Draw the teapot (always assumed to be reflecting)
function drawTeapot(cameraMatrix) {
    // Draw the cube with per-vertex colors
    useReflection()
    gl.uniformMatrix4fv(g_u_model_ref_reflection, false, g_modelMatrixTeapot.elements)
    gl.uniformMatrix4fv(g_u_world_ref_reflection, false, g_worldMatrixTeapot.elements)
    gl.uniformMatrix4fv(g_u_camera_ref_reflection, false, cameraMatrix.elements)
    gl.uniformMatrix4fv(g_u_projection_ref_reflection, false, g_projectionMatrix.elements)

    // calculate our inverse to "get back" to model space
    var cameraModelWorldInverse = new Matrix4(cameraMatrix).multiply(g_worldMatrixTeapot).multiply(g_modelMatrixTeapot)
    cameraModelWorldInverse.invert()
    gl.uniformMatrix4fv(g_u_cameraworldmodel_inverse_ref_reflection, false, cameraModelWorldInverse.elements)

    // bind the reflection data for sampling
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, g_reflectionDataTexture)
    gl.uniform1i(g_u_reflectionBox_ref_reflection, g_reflectionDataTexture)

    // draw our cube
    gl.drawArrays(gl.TRIANGLES, (SQUARE_MESH.length + CUBE_MESH.length) / 3, g_teapotMesh.length / 3)
}

// Helper to swap to per-vertex and update attribute pointers
function usePerVertex() {
    gl.useProgram(g_program_pervertex)

    if (!setupVec(3, g_program_pervertex, 'a_Position', 0, 0)) {
        return
    }
    if (!setupVec(3, g_program_pervertex, 'a_Color', 0, 
        (SQUARE_MESH.length + CUBE_MESH.length + g_teapotMesh.length) * FLOAT_SIZE)) {
        return
    }
}

// Helper to swap to skybox and update attribute pointers
function useSkybox() {
    gl.useProgram(g_program_skybox)

    if (!setupVec(3, g_program_skybox, 'a_Position', 0, 0)) {
        return
    }
}

// Helper to swap to per-vertex and update attribute pointers
function useReflection() {
    gl.useProgram(g_program_reflection)

    if (!setupVec(3, g_program_reflection, 'a_Position', 0, 0)) {
        return
    }
    if (!setupVec(3, g_program_reflection, 'a_Normal', 0, 
        (SQUARE_MESH.length + CUBE_MESH.length + g_teapotMesh.length) * FLOAT_SIZE * 2)) {
        return
    }
}

/*
 * Helper function to setup key binding logic
 */
function setupKeyBinds() {
    // Start movement when the key starts being pressed
    document.addEventListener('keydown', function(event) {
        if (event.key == 'w') {
			g_movingUp = true
		}
        else if (event.key == 's') {
			g_movingDown = true
		}
        else if (event.key == 'a') {
			g_movingLeft = true
		}
        else if (event.key == 'd') {
			g_movingRight = true
		}
	})

    // End movement on key release
    document.addEventListener('keyup', function(event) {
        if (event.key == 'w') {
			g_movingUp = false
		}
        else if (event.key == 's') {
			g_movingDown = false
		}
        else if (event.key == 'a') {
			g_movingLeft = false
		}
        else if (event.key == 'd') {
			g_movingRight = false
		}
	})
}

// Helper to construct colors
// makes every triangle a slightly different shade of red
function buildColorAttributes(vertexCount) {
    var colors = []
    for (var i = 0; i < vertexCount / 3; i++) {
        // three vertices per triangle
        for (var vert = 0; vert < 3; vert++) {
            var shade = (i * 3) / vertexCount
            colors.push(1.0, shade, shade)
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