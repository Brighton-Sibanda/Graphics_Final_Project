precision highp float;

// Setup our varyings
varying vec3 v_Position;

uniform mat4 u_Model;
uniform mat4 u_World;
uniform mat4 u_LightProjection;
uniform mat4 u_Light;

// helper function for homogeneous transformation
vec3 hom_reduce(vec4 v) {
    return vec3(v) / v.w;
}

void main() {
    // put position in the _light_ projection space
    vec3 projPos = hom_reduce(u_LightProjection * u_Light * u_World * u_Model * vec4(v_Position, 1.0));

    // calculate distance
    float shade = ((projPos.z + 1.0) / 2.0);

    // "widen" shade to help with visualizing distances
    shade = pow(shade, 3.0);
    gl_FragColor = vec4(shade, shade, shade, 1.0);
}