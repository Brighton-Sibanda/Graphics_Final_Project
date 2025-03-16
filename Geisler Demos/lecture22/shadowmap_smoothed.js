// Last edited by Dietrich Geisler 2025

// shaders
var g_vshaderShadow
var g_fshaderShadow
var g_vshaderLighting
var g_fshaderLighting

// programs
var g_programShadow
var g_programLighting

// matrices
var g_modelMatrixTeapot
var g_worldMatrixTeapot
var g_modelMatrixFloor
var g_worldMatrixFloor
var g_projectionMatrix

// references to general information
var g_canvas
var gl

// shadow pointers
var g_model_ref_shadow
var g_world_ref_shadow
var g_camera_ref_shadow
var g_projection_ref_shadow
var g_inverse_transpose_ref_shadow

// texture pointer
var g_model_ref_depth
var g_texture_ref_depth

// lighting pointers
var g_model_ref_lighting
var g_world_ref_lighting
var g_camera_ref_lighting
var g_projection_ref_lighting
var g_inverse_transpose_ref_lighting
var g_shadow_texture_ref_lighting
var g_shadow_texel_size_ref
var g_light_transform_ref_lighting
var g_light_ref_lighting
var g_ambient_color_ref_lighting
var g_diffuse_color_ref_lighting
var g_spec_power_ref_lighting
var g_spec_color_ref_lighting

// information about our framebuffers and data texture
var g_framebuffer
var g_dataTexture

// keep track of the camera position, always looking at the world center
var g_cameraDistance
var g_cameraAngle
var g_cameraHeight

// global parameters
var g_lightPosition
var g_shadowOrtho

// Key states
var g_movingUp
var g_movingDown
var g_movingLeft
var g_movingRight
var g_movingForward
var g_movingBackward

// constants
const DATA_TEXTURE_WIDTH = 256
const DATA_TEXTURE_HEIGHT = 256
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
    g_vshaderShadow = await fetch('./shadow.vert').then(response => response.text()).then((x) => x)
    g_fshaderShadow = await fetch('./shadow.frag').then(response => response.text()).then((x) => x)
    g_vshaderLighting = await fetch('./shadow_light_smoothed.vert').then(response => response.text()).then((x) => x)
    g_fshaderLighting = await fetch('./shadow_light_smoothed.frag').then(response => response.text()).then((x) => x)
    g_vshaderFlat = await fetch('./flat.vert').then(response => response.text()).then((x) => x)
    g_fshaderFlat = await fetch('./flat.frag').then(response => response.text()).then((x) => x)

    // wait until everything is loaded before rendering
    startRendering()
}

function startRendering() {
    // Compile all of the vshaders and fshaders
    g_programShadow = createProgram(gl, g_vshaderShadow, g_fshaderShadow)
    if (!g_programShadow) {
        console.log('Failed to intialize shaders.')
        return
    }
    g_programLighting = createProgram(gl, g_vshaderLighting, g_fshaderLighting)
    if (!g_programLighting) {
        console.log('Failed to intialize shaders.')
        return
    }
    g_programFlat = createProgram(gl, g_vshaderFlat, g_fshaderFlat)
    if (!g_programFlat) {
        console.log('Failed to intialize shaders.')
        return
    }

    // note that we need the texture mapping to draw the screen fragments
    var data = g_teapotMesh.concat(CUBE_MESH)
        .concat(g_teapotNormals).concat(CUBE_NORMALS)
    if (!initVBO(new Float32Array(data))) {
        return
    }

    // reference to the shadow shader pointers
    g_model_ref_shadow = gl.getUniformLocation(g_programShadow, 'u_Model')
    g_world_ref_shadow = gl.getUniformLocation(g_programShadow, 'u_World')
    g_camera_ref_shadow = gl.getUniformLocation(g_programShadow, 'u_Camera')
    g_projection_ref_shadow = gl.getUniformLocation(g_programShadow, 'u_Projective')

    // reference to the lighting shader pointers
    g_lighting_ref = gl.getUniformLocation(g_programLighting, 'u_Lighting')
    g_model_ref_lighting = gl.getUniformLocation(g_programLighting, 'u_Model')
    g_world_ref_lighting = gl.getUniformLocation(g_programLighting, 'u_World')
    g_camera_ref_lighting = gl.getUniformLocation(g_programLighting, 'u_Camera')
    g_projection_ref_lighting = gl.getUniformLocation(g_programLighting, 'u_Projective')
    g_inverse_transpose_ref_lighting = gl.getUniformLocation(g_programLighting, 'u_ModelWorldInverseTranspose')
    g_shadow_texture_ref_lighting = gl.getUniformLocation(g_programLighting, 'u_ShadowTexture')
    g_shadow_texel_size_ref_lighting = gl.getUniformLocation(g_programLighting, 'u_ShadowTexelSize')
    g_light_transform_ref_lighting = gl.getUniformLocation(g_programLighting, 'u_LightTransform')
    g_light_ref_lighting = gl.getUniformLocation(g_programLighting, 'u_Light')
    g_ambient_color_ref_lighting = gl.getUniformLocation(g_programLighting, 'u_AmbientColor')
    g_diffuse_color_ref_lighting = gl.getUniformLocation(g_programLighting, 'u_DiffuseColor')
    g_spec_power_ref_lighting = gl.getUniformLocation(g_programLighting, 'u_SpecPower')
    g_spec_color_ref_lighting = gl.getUniformLocation(g_programLighting, 'u_SpecColor')

    // reference to the flat shader pointers
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

    // setup an orthographic matrix for the light
    g_shadowOrtho = new Matrix4().setOrtho(-10, 10, -10, 10, -200, 200)

    // https://webglfundamentals.org/webgl/lessons/webgl-render-to-texture.html
    // Create a texture to write data to
    g_dataTexture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, g_dataTexture)

    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA,
        DATA_TEXTURE_WIDTH, DATA_TEXTURE_HEIGHT, 0,
        gl.RGBA, gl.UNSIGNED_BYTE, null); // Note the null data, webgl will update this texture

    // Filter so we don't need a mipmap (nearest is fine)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

    // create a framebuffer so we can refer to the data from rendering the scene
    g_framebuffer = gl.createFramebuffer()
    gl.bindFramebuffer(gl.FRAMEBUFFER, g_framebuffer)

    // setup a framebuffer location to map to g_data_texture
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, g_dataTexture, 0)

    // create a depth renderbuffer so we get proper depth culling in the framebuffer
    var depth_buffer = gl.createRenderbuffer()
    gl.bindRenderbuffer(gl.RENDERBUFFER, depth_buffer)
        
    // make a depth buffer and the same size as the targetTexture
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, DATA_TEXTURE_WIDTH, DATA_TEXTURE_HEIGHT)
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depth_buffer)

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
    gl.bindFramebuffer(gl.FRAMEBUFFER, g_framebuffer)
    gl.viewport(0, 0, DATA_TEXTURE_WIDTH, DATA_TEXTURE_HEIGHT)
    gl.disable(gl.CULL_FACE) // cull face doesn't make sense with shadows!
    drawShadow()
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, g_canvas.width, g_canvas.height)
    gl.enable(gl.CULL_FACE)
    drawScene()
}

function drawShadow() {
    gl.useProgram(g_programShadow)
    
    // put the shadow attributes on the VBO
    if (setupVec(3, g_programShadow, 'a_Position', 0) < 0) {
        return -1
    }

    // setup our light source "direction"
    // always look at the teapot (a constant number because I'm lazy)
    var cameraMatrix = new Matrix4().setLookAt(...g_lightPosition, 0, 0, TEAPOT_Z_CENTER, 0, 1, 0)
    gl.uniformMatrix4fv(g_camera_ref_shadow, false, cameraMatrix.elements)

    // use an orthogonal camera for shadows (there's no perspective in a shadow!)
    gl.uniformMatrix4fv(g_projection_ref_shadow, false, g_shadowOrtho.elements)

    gl.enable(gl.DEPTH_TEST)

    // Clear the canvas with a black background
    gl.clearColor(0.0, 0.0, 0.0, 1.0)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

    // Draw the teapot
    gl.uniformMatrix4fv(g_model_ref_shadow, false, g_modelMatrixTeapot.elements)
    gl.uniformMatrix4fv(g_world_ref_shadow, false, g_worldMatrixTeapot.elements)
    gl.drawArrays(gl.TRIANGLES, 0, g_teapotMesh.length / 3)

    // Draw the floor
    gl.uniformMatrix4fv(g_model_ref_shadow, false, g_modelMatrixFloor.elements)
    gl.uniformMatrix4fv(g_world_ref_shadow, false, g_worldMatrixFloor.elements)
    gl.drawArrays(gl.TRIANGLES, g_teapotMesh.length / 3, CUBE_MESH.length / 3)
}

function drawScene() {
    gl.useProgram(g_programLighting)

    // put the lighting attributes on the VBO
    if (setupVec(3, g_programLighting, 'a_Position', 0, 0) < 0) {
        return -1
    }
    if (setupVec(3, g_programLighting, 'a_Normal', 0, (g_teapotMesh.length + CUBE_MESH.length) * FLOAT_SIZE) < 0) {
        return -1
    }

    // setup our shadowTexture
    gl.uniform1i(g_shadow_texture_ref_lighting, g_dataTexture)
    gl.uniform1f(g_shadow_texel_size_ref_lighting, 1.0 / DATA_TEXTURE_WIDTH)

    // setup our light matrix (the same matrix used to calculate shadows)
    var lightViewMatrix = new Matrix4().setLookAt(...g_lightPosition, 0, 0, TEAPOT_Z_CENTER, 0, 1, 0)
    var lightMatrix = new Matrix4(g_shadowOrtho).multiply(lightViewMatrix)
    gl.uniformMatrix4fv(g_light_transform_ref_lighting, false, lightMatrix.elements)

    // setup our camera and projections
    cameraMatrix = calculateCameraMatrix()
    gl.uniformMatrix4fv(g_camera_ref_lighting, false, cameraMatrix.elements)
    gl.uniformMatrix4fv(g_projection_ref_lighting, false, g_projectionMatrix.elements)

    // setup our light source
    gl.uniform3fv(g_light_ref_lighting, new Float32Array(g_lightPosition))

    // Clear the canvas with a black background
    gl.clearColor(0.0, 0.0, 0.0, 1.0)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

    // Setup the teapot matrices
    gl.uniformMatrix4fv(g_model_ref_lighting, false, g_modelMatrixTeapot.elements)
    gl.uniformMatrix4fv(g_world_ref_lighting, false, g_worldMatrixTeapot.elements)
    var inv = new Matrix4(g_worldMatrixTeapot)
        .concat(g_modelMatrixTeapot)
        .invert().transpose()
    gl.uniformMatrix4fv(g_inverse_transpose_ref_lighting, false, inv.elements)

    // use lighting for the teapot and cube
    gl.uniform1i(g_lighting_ref, 1)

    // set a position and colors for the teapot, and draw
    gl.uniform3fv(g_ambient_color_ref_lighting, new Float32Array([0, 0, 0]))
    gl.uniform3fv(g_diffuse_color_ref_lighting, new Float32Array([0.1, .5, .8]))
    gl.uniform1f(g_spec_power_ref_lighting, 256.0)
    gl.uniform3fv(g_spec_color_ref_lighting, new Float32Array([1, 1, 1]))

    gl.drawArrays(gl.TRIANGLES, 0, g_teapotMesh.length / 3)

    // Setup the floor matrices
    gl.uniformMatrix4fv(g_model_ref_lighting, false, g_modelMatrixFloor.elements)
    gl.uniformMatrix4fv(g_world_ref_lighting, false, g_worldMatrixFloor.elements)
    var inv = new Matrix4(g_worldMatrixFloor)
        .concat(g_modelMatrixFloor)
        .invert().transpose()
    gl.uniformMatrix4fv(g_inverse_transpose_ref_lighting, false, inv.elements)

    // set a position and colors for the floor, and draw
    gl.uniform3fv(g_ambient_color_ref_lighting, new Float32Array([.4, .25, .1]))
    gl.uniform3fv(g_diffuse_color_ref_lighting, new Float32Array([.3, .3, .3]))
    gl.uniform1f(g_spec_power_ref_lighting, 64.0)
    gl.uniform3fv(g_spec_color_ref_lighting, new Float32Array([1, 1, 1]))

    gl.drawArrays(gl.TRIANGLES, g_teapotMesh.length / 3, CUBE_MESH.length / 3)

    // switch to flat lighting
    gl.useProgram(g_programFlat)
    if (!setupVec(3, g_programFlat, 'a_Position', 0, 0)) {
        return
    }

    // draw our cube light
    gl.uniformMatrix4fv(g_model_ref_flat, false, new Matrix4().scale(.1, .1, .1).elements)
    gl.uniformMatrix4fv(g_world_ref_flat, false, new Matrix4().translate(...g_lightPosition).elements)
    gl.uniformMatrix4fv(g_camera_ref_flat, false, cameraMatrix.elements)
    gl.uniformMatrix4fv(g_projection_ref_flat, false, g_projectionMatrix.elements)

    gl.drawArrays(gl.TRIANGLES, g_teapotMesh.length / 3, CUBE_MESH.length / 3)
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