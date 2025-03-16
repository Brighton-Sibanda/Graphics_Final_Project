// Last edited by Dietrich Geisler 2024

// references to the GLSL programs we need to load
var g_vshaderBase
var g_fshaderBase
var g_vshaderReflect
var g_fshaderReflect

// references to compiled shaders
var g_programBase
var g_programReflect

// global hooks for updating data
var g_canvas
var gl
var g_model_base
var g_world_base
var g_camera_base
var g_projection_base
var g_model_reflect
var g_world_reflect
var g_camera_reflect
var g_projection_reflect

// Matrices for two cubes
var g_modelMatrixRef
var g_worldMatrixRed
var g_modelMatrixReflect
var g_worldMatrixReflect

// Matrices for positioning the grid
var g_modelMatrixGrid
var g_worldMatrixGrid

// universal projection matrix
var g_projectionMatrix

// keep track of the camera position, always looking at the center
var g_cameraDistance
var g_cameraAngle
var g_cameraHeight

// Previous frame time, used for calculating framerate
var g_lastFrameMS

// information about our framebuffers and data texture
var g_framebuffer
var g_dataTexture
var g_u_texture

// Key states
var g_movingUp
var g_movingDown
var g_movingLeft
var g_movingRight
var g_movingForward
var g_movingBackward

// define width and height to be some fixed-size power-of-two
const DATA_TEXTURE_WIDTH = 256
const DATA_TEXTURE_HEIGHT = 256

// grid mesh
var g_gridMesh

// Cube setup offsets for rotating around a center point
const RED_Z_OFFSET = -6
const REFLECT_Z_OFFSET = -4

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

// Our scene has 2 cubes
const CUBE_COUNT = 2

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

    loadGLSLFiles()
}

async function loadGLSLFiles() {
    g_vshaderBase = await fetch('./reflect_base.vert').then(response => response.text()).then((x) => x)
    g_fshaderBase = await fetch('./reflect_base.frag').then(response => response.text()).then((x) => x)
    g_vshaderReflect = await fetch('./reflection.vert').then(response => response.text()).then((x) => x)
    g_fshaderReflect = await fetch('./reflection.frag').then(response => response.text()).then((x) => x)

    // wait until everything is loaded before rendering
    startRendering()
}

function startRendering() {
    // Get the rendering context for WebGL
    gl = getWebGLContext(g_canvas, true)
    if (!gl) {
        console.log('Failed to get the rendering context for WebGL')
        return
    }

    // Initialize GPU's vertex and fragment shaders programs
    g_programBase = createProgram(gl, g_vshaderBase, g_fshaderBase)
    if (!g_programBase) {
      console.log('Failed to create program')
      return
    }

    // Initialize a _second_ set of vertex and fragment shaders
    g_programReflect = createProgram(gl, g_vshaderReflect, g_fshaderReflect)
    if (!g_programReflect) {
        console.log('Failed to create program')
        return
    }

    // get the grid mesh and colors
    // use a spacing of 1 for now, for a total of 200 lines
    // use a simple green color
    gridData = buildGridAttributes(2, 2, [0, .7, .1])
    g_gridMesh = gridData[0]
    g_gridColor = gridData[1]

    // setup two cubes of different colors and a grid
    var data = CUBE_MESH.concat(CUBE_MESH).concat(g_gridMesh)
    data = data.concat(buildColorAttributes(true, CUBE_MESH.length / TRIANGLE_SIZE))
    data = data.concat(buildColorAttributes(false, CUBE_MESH.length / TRIANGLE_SIZE))
    data = data.concat(g_gridColor)
    // finally, add our tex coordinates for the reflecting cube
    // add two copies to align things
    data = data.concat(CUBE_TEX_MAPPING).concat(CUBE_TEX_MAPPING)
    if (!initVBO(new Float32Array(data))) {
        return
    }

    // https://webglfundamentals.org/webgl/lessons/webgl-render-to-texture.html
    // Create a texture to write data to
    g_dataTexture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, g_dataTexture)

    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA,
        DATA_TEXTURE_WIDTH, DATA_TEXTURE_HEIGHT, 0,
        gl.RGBA, gl.UNSIGNED_BYTE, null); // Note the null data, webgl will update this texture

    // Filter so we don't need a mipmap (linear is fine)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)

    // create framebuffer so we can refer to the data from rendering the scene
    g_framebuffer = gl.createFramebuffer()
    gl.bindFramebuffer(gl.FRAMEBUFFER, g_framebuffer)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, g_dataTexture, 0)

    // create a depth renderbuffer so we get proper depth culling in the framebuffer
    var depth_buffer = gl.createRenderbuffer()
    gl.bindRenderbuffer(gl.RENDERBUFFER, depth_buffer)
        
    // make a depth buffer and the same size as the targetTexture
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, DATA_TEXTURE_WIDTH, DATA_TEXTURE_HEIGHT)
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depth_buffer)

    // get our uniform references for the first program
    g_model_base = gl.getUniformLocation(g_programBase, 'u_Model')
    g_world_base = gl.getUniformLocation(g_programBase, 'u_World')
    g_camera_base = gl.getUniformLocation(g_programBase, 'u_Camera')
    g_projection_base = gl.getUniformLocation(g_programBase, 'u_Projection')

    // get our uniform references for the second program
    g_model_reflect = gl.getUniformLocation(g_programReflect, 'u_Model')
    g_world_reflect = gl.getUniformLocation(g_programReflect, 'u_World')
    g_camera_reflect = gl.getUniformLocation(g_programReflect, 'u_Camera')
    g_projection_reflect = gl.getUniformLocation(g_programReflect, 'u_Projection')

    // Setup our baseline matrices
    g_modelMatrixRef = new Matrix4().scale(.6, .6, .6)
    g_worldMatrixRed = new Matrix4().translate(0, 0, RED_Z_OFFSET)

    g_modelMatrixReflect = new Matrix4().scale(.6, .6, .6).rotate(30, 0, 1, 0)
    g_worldMatrixReflect = new Matrix4().translate(0, 0, REFLECT_Z_OFFSET)

    // Put the grid "below" the camera (and cubes)
    g_modelMatrixGrid = new Matrix4()
    g_worldMatrixGrid = new Matrix4().translate(0, -1, 0)

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

    // Enable face culling and the depth test
    gl.enable(gl.CULL_FACE)
    gl.enable(gl.DEPTH_TEST)

    draw()
}

const ROTATION_SPEED = .08
const CAMERA_SPEED = .003
const CAMERA_ROT_SPEED = .1

// update the cube rotations
function tick() {
    var deltaTime

    // calculate time since the last frame
    var currentTime = Date.now()
    deltaTime = currentTime - g_lastFrameMS
    g_lastFrameMS = currentTime

    // Rotate around the (0, 0, -3) point via the Y axis, as fixed by our starting positions
    g_worldMatrixRed.translate(0, 0, -4 - RED_Z_OFFSET)
        .rotate(deltaTime * ROTATION_SPEED, 0, 1, 0)
        .translate(0, 0, RED_Z_OFFSET + 4)

    updateCameraMovement(deltaTime)

    draw()
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


// draw to the screen on the next frame
function draw() {
    // draw to the reflecting cube face
    gl.bindTexture(gl.TEXTURE_2D, g_dataTexture)
    gl.bindFramebuffer(gl.FRAMEBUFFER, g_framebuffer)
    gl.clearColor(0.0, 0.0, 0.0, 1.0)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
    drawFromCube()

    // now, draw the scene
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.clearColor(0.0, 0.0, 0.0, 1.0)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
    drawScene()
    requestAnimationFrame(tick, g_canvas)
}

function useProgram1() {
    // switch to program 1
    gl.useProgram(g_programBase)   

    // setup the attributes for program1
    if (setupVec(3, g_programBase, 'a_Position', 0, 0) < 0) {
        return -1
    }
    var offset = CUBE_MESH.length * CUBE_COUNT + g_gridMesh.length
    if (setupVec(3, g_programBase, 'a_Color', 0, offset * FLOAT_SIZE) < 0) {
        return -1
    }
}

function useProgram2() {
    // switch to program 2
    gl.useProgram(g_programReflect)

    // setup the attributes for program2
    if (setupVec(3, g_programReflect, 'a_Position', 0, 0) < 0) {
        return -1
    }
    // note the `* 2` to account for colors
    var offset = (CUBE_MESH.length * CUBE_COUNT + g_gridMesh.length) * 2
    if (setupVec(2, g_programReflect, 'a_TexCoord',  0, offset * FLOAT_SIZE) < 0) {
        return -1
    }
}

function drawFromCube() {
    // Switch to program 1
    useProgram1()

    // setup the viewport to draw to a data texture
    gl.viewport(0, 0, DATA_TEXTURE_WIDTH, DATA_TEXTURE_HEIGHT)

    // use our reflecting cube model and world matrix as our camera (!)
    // note that we need to rotate our model matrix make our reflection point "out"
    var cameraMatrix = new Matrix4(g_worldMatrixReflect)
        .concat(new Matrix4(g_modelMatrixReflect).rotate(180, 0, 1, 0))
        .invert()
    gl.uniformMatrix4fv(g_camera_base, false, cameraMatrix.elements)
    // we could use another projection matrix for the reflection, but our default is probably fine
    gl.uniformMatrix4fv(g_projection_base, false, g_projectionMatrix.elements)

    // Draw the red cube
    gl.uniformMatrix4fv(g_model_base, false, g_modelMatrixRef.elements)
    gl.uniformMatrix4fv(g_world_base, false, g_worldMatrixRed.elements)
    gl.drawArrays(gl.TRIANGLES, 0, CUBE_MESH.length / 3)

    // draw the grid with gl.lines
    // Note that we can use the regular vertex offset with gl.LINES
    gl.uniformMatrix4fv(g_model_base, false, g_modelMatrixGrid.elements)
    gl.uniformMatrix4fv(g_world_base, false, g_worldMatrixGrid.elements)
    gl.drawArrays(gl.LINES, 
        CUBE_MESH.length / TRIANGLE_SIZE * CUBE_COUNT, 
        g_gridMesh.length / TRIANGLE_SIZE)

    // We don't need to draw the reflecting cube!
}

function drawScene() {
    // Build a new lookat matrix each frame
    var cameraMatrix = calculateCameraMatrix()

    // Make sure we're using program 1
    useProgram1()

    gl.viewport(0, 0, g_canvas.width, g_canvas.height)

    // Update our projection and camera matrices
    // Use the same projection and camera for everything
    gl.uniformMatrix4fv(g_camera_base, false, cameraMatrix.elements)
    gl.uniformMatrix4fv(g_projection_base, false, g_projectionMatrix.elements)

    // Draw the red cube
    gl.uniformMatrix4fv(g_model_base, false, g_modelMatrixRef.elements)
    gl.uniformMatrix4fv(g_world_base, false, g_worldMatrixRed.elements)
    gl.drawArrays(gl.TRIANGLES, 0, CUBE_MESH.length / 3)

    // Draw most of the reflecting cube faces normally
    gl.uniformMatrix4fv(g_model_base, false, g_modelMatrixReflect.elements)
    gl.uniformMatrix4fv(g_world_base, false, g_worldMatrixReflect.elements)
    gl.drawArrays(gl.TRIANGLES, CUBE_MESH.length / 3 + 6, 30)

    // Draw the grid with gl.lines
    // Note that we can use the regular vertex offset with gl.LINES
    gl.uniformMatrix4fv(g_model_base, false, g_modelMatrixGrid.elements)
    gl.uniformMatrix4fv(g_world_base, false, g_worldMatrixGrid.elements)
    gl.drawArrays(gl.LINES, 
        CUBE_MESH.length / TRIANGLE_SIZE * CUBE_COUNT, 
        g_gridMesh.length / TRIANGLE_SIZE)

    // switch to program2 to draw the reflecting cube face
    useProgram2()

    // use our same camera/perspective for program2
    gl.uniformMatrix4fv(g_camera_reflect, false, cameraMatrix.elements)
    gl.uniformMatrix4fv(g_projection_reflect, false, g_projectionMatrix.elements)

    // setup our model/world matrices for the reflecting cube
    gl.uniformMatrix4fv(g_model_reflect, false, g_modelMatrixReflect.elements)
    gl.uniformMatrix4fv(g_world_reflect, false, g_worldMatrixReflect.elements)

    gl.uniform1i(g_u_texture, g_dataTexture)
    gl.drawArrays(gl.TRIANGLES, CUBE_MESH.length / 3, 6)
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
 * Helper to build a grid mesh and colors
 * Returns these results as a pair of arrays
 * Each vertex in the mesh is constructed with an associated grid_color
 */
function buildGridAttributes(grid_row_spacing, grid_column_spacing, grid_color) {
    var mesh = []
    var colors = []

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

    // We need one color per vertex
    // since we have 3 components for each vertex, this is length/3
    for (var i = 0; i < mesh.length / 3; i++) {
        colors.push(grid_color[0], grid_color[1], grid_color[2])
    }

    return [mesh, colors]
}

// Helper to construct colors
// makes every triangle a slightly different shade of blue or red
function buildColorAttributes(isRed, vertexCount) {
    var colors = []
    for (var i = 0; i < vertexCount / TRIANGLE_SIZE; i++) {
        // three vertices per triangle
        for (var vert = 0; vert < TRIANGLE_SIZE; vert++) {
            var shade = (i * TRIANGLE_SIZE) / vertexCount
            if (isRed) {
                colors.push(1.0, shade, shade)
            }
            else {
                colors.push(shade, shade, 1.0)
            }
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