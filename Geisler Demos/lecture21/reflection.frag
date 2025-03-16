// Loosely based on https://webglfundamentals.org/webgl/lessons/webgl-skybox.html
// Also based on https://github.com/cucapra/gator/blob/master/examples/reflection/fragment.lgl

precision highp float;
varying vec3 v_Normal;
varying vec3 v_Position;

uniform mat4 u_Model;
uniform mat4 u_World;
uniform mat4 u_Camera;
uniform mat4 u_CameraWorldModelInverse;

// The box to sample from
uniform samplerCube u_ReflectionBox;

void main() {
    vec3 cameraPosition = vec3(u_Camera * u_World * u_Model * vec4(v_Position, 1.0));
    vec3 cameraNormal = vec3(u_Camera * u_World * u_Model * vec4(v_Normal, 0.0));
    // We need to first reflect our position across our normal
    vec3 reflectedDirection = reflect(cameraPosition, cameraNormal);

    // once we have the reflected vector, we need to put that _back_ in model space
    vec3 modelReflected = vec3(u_CameraWorldModelInverse * vec4(reflectedDirection, 0.0));

    // we can then sample the reflection box
    gl_FragColor = textureCube(u_ReflectionBox, normalize(modelReflected));
}