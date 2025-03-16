attribute vec3 a_Position;
attribute vec2 a_TexCoord;
uniform mat4 u_Model;
uniform mat4 u_World;
uniform mat4 u_Camera;
uniform mat4 u_Projection;

varying vec3 v_Position;
varying vec2 v_TexCoord;

void main() {
    gl_Position = u_Projection * u_Camera * u_World 
        * u_Model * vec4(a_Position, 1.0);

    v_Position = a_Position;
    v_TexCoord = a_TexCoord;
}